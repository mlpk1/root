package poller

import (
	"container/heap"
	"fmt"
	"sync"

	"github.com/boomfunc/root/base/tools"
)

type HeapItem struct {
	Fd    uintptr
	Value interface{}
	ready bool
}

// String implements fmt.Stringer interface
func (item *HeapItem) String() string {
	return fmt.Sprintf("HeapItem(fd: %d, value: %v, ready: %t)", item.Fd, item.Value, item.ready)
}

type pollerHeap struct {
	// poller integration
	// and sync locking section
	poller Interface
	once   tools.Once // poller invoking only once per time
	cond   *sync.Cond // poller ready (waiting) condition

	// mutex and state
	mutex   sync.Mutex // this mutex guards variables below
	pending []*HeapItem
}

// HeapWithPoller creates instance of heap.Interface with poller background refresh
// the provided poller will be used
func HeapWithPoller(poller Interface) (heap.Interface, error) {
	h := new(pollerHeap)
	h.poller = poller
	h.cond = sync.NewCond(new(sync.Mutex))
	h.pending = make([]*HeapItem, 0)

	heap.Init(h)
	return h, nil
}

// Heap creates instance of heap.Interface with poller background refresh
// poller will be selected based on OS
func Heap() (heap.Interface, error) {
	poller, err := New()
	if err != nil {
		return nil, err
	}

	return HeapWithPoller(poller)
}

func (h *pollerHeap) len() int {
	return len(h.pending)
}

func (h *pollerHeap) Len() int {
	h.mutex.Lock()
	n := h.len()
	h.mutex.Unlock()

	return n
}

func (h *pollerHeap) less(i, j int) bool {
	// Less reports whether the element with
	// index i should sort before the element with index j.
	if !h.pending[i].ready && h.pending[j].ready {
		return true
	}
	return false
}

func (h *pollerHeap) Less(i, j int) bool {
	return false
	// h.mutex.RLock()
	// b := h.less(i, j)
	// h.mutex.RUnlock()
	//
	// return b
}

func (h *pollerHeap) swap(i, j int) {
	if h.len() >= 2 {
		// there is something to swap
		h.pending[i], h.pending[j] = h.pending[j], h.pending[i]
	}
}

func (h *pollerHeap) Swap(i, j int) {
	return
	// h.mutex.Lock()
	// h.swap(i, j)
	// h.mutex.Unlock()
}

// Push implements heap.Interface
// adds flow to poller
func (h *pollerHeap) Push(x interface{}) {
	if item, ok := x.(*HeapItem); ok {
		h.mutex.Lock()

		// try to add to poller
		if err := h.poller.Add(item.Fd); err == nil {
			// fd in poller, store it for .Pop()
			h.pending = append(h.pending, item)
		} else {
			// TODO error not visible! in transport layer
		}

		h.mutex.Unlock()
	}
}

// Pop implements heap.Interface
// pops first in flow with `ready` status
func (h *pollerHeap) Pop() interface{} {
	for {
		// background poll refresh
		go h.Poll(false) // NOTE: this polling instance do not wait any conditions, will release blindly

		// try to pop ready
		h.mutex.Lock()
		value := h.pop()
		h.mutex.Unlock()

		// check for wait
		if value != nil {
			return value
		}

		// we checked fetched value and it is not valid -. we need to wait for nearest polling
		h.PollWait()
	}
}

// poll is the main link between heap and core poller
// blocking operation until really received some events
// otherwise poll again
func (h *pollerHeap) poll() ([]uintptr, []uintptr) {
	var re, ce []Event

	for {
		var err error
		// fetching events from poller
		// blocking mode !!!
		re, ce, err = h.poller.Events()
		if err != nil {
			// some error from poller -> poll again
			continue
		}

		if len(re)+len(ce) == 0 {
			// not required events came -> poll again
			continue
		}

		// all fetched without errors
		return EventsToFds(re...), EventsToFds(ce...)
	}
}

// Poll is thread safety operation for waiting events from poller
// and actualize heap data
// NOTE: Poll may be invoked as many times as wants - only one instance of this will be really invoked
func (h *pollerHeap) Poll(locking bool) {
	// f is poll with actualizing heap data
	// Only one running instance of this function per time across all workers
	f := func() {
		// lock polling condition
		// NOTE: if locking == false this Polling will not wait h.cond.L.Unlock from another routine
		// NOTE: otherwise it will wait, for example to be sure h.cond.Wait() already invoked
		if locking {
			h.cond.L.Lock() // NOTE: if h.cond.L.Lock() invoked before - this will wait for h.cond.Wait()
			defer h.cond.L.Unlock()
		}

		// blocking mode operation !!
		re, ce := h.poll()

		// events are received (and they are!)
		h.mutex.Lock()
		h.actualize(re, ce) // push ready, excluding closed
		h.mutex.Unlock()

		// release waiting for this instance of polling
		// NOTE: only real invokes of .poll() (real Once.Do) can release waiting goroutines
		h.cond.Broadcast()
	}

	// f invokes with mutex locking on once.Do layer
	// but once.m is a different mutex than h.mutex
	// -> f() not thread safety
	h.once.Do(f, true)
}

func (h *pollerHeap) PollWait() {
	// NOTE: this guarantees that h.cond.Wait() will be called before h.cond.Broadcast()
	// NOTE: in case whent we invoke .Poll with locking == true
	h.cond.L.Lock()

	go h.Poll(true) // NOTE: this polling instance will wait for ublocking (in .Wait in our case) and release existing waiting routines
	h.cond.Wait()

	// release waiting
	h.cond.L.Unlock()
}

// actualize called after success polling process finished
// purpose: update state (add new ready, delete closed)
func (h *pollerHeap) actualize(ready []uintptr, close []uintptr) {
	filtered := pendingFilterClosed(h.pending, close)
	mapped := pendingMapReady(filtered, ready)

	h.pending = mapped
}

// pop searches first entry in `pending` slice
// which has `ready` flag == true
func (h *pollerHeap) pop() interface{} {
	if h.len() == 0 {
		return nil
	}

	// there is something to pop (at first sight)
	// get first fd from heap, available in pending
	for i, item := range h.pending {
		if item.ready {
			h.pending = append(h.pending[:i], h.pending[i+1:]...)
			return item.Value
		}
	}

	// nobody ready
	return nil
}

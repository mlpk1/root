// +build linux

package poller

import (
	"golang.org/x/sys/unix"
)

type epollEvent struct {
	se unix.EpollEvent // source event
}

// Fd implements base Event interface
func (ev epollEvent) Fd() uintptr {
	return uintptr(ev.se.Fd)
}

type epoll struct {
	fd int
}

func New() (Interface, error) {
	// create epoll
	fd, err := unix.EpollCreate1(0)
	if err != nil {
		return nil, err
	}

	poller := &epoll{fd}
	return poller, nil
}

func (p *epoll) Add(fd uintptr) error {
	if err := unix.SetNonblock(int(fd), true); err != nil {
		return err
	}

	event := &unix.EpollEvent{
		Events: unix.EPOLLIN | unix.EPOLLRDHUP | unix.EPOLLET | unix.EPOLLONESHOT,
		Fd:     int32(fd),
	}

	return unix.EpollCtl(p.fd, unix.EPOLL_CTL_ADD, int(fd), event)
}

func (p *epoll) Del(fd uintptr) error {
	return unix.EpollCtl(p.fd, unix.EPOLL_CTL_DEL, int(fd), nil)
}

func (p *epoll) Events() ([]Event, []Event, error) {
	events, err := p.wait()
	if err != nil {
		return nil, nil, err
	}

	// something received, try it
	var re, ce []Event
	for _, event := range events {
		ev := toEvent(event)

		if event.Events&(unix.EPOLLRDHUP|unix.EPOLLHUP) != 0 {
			// closed by peer
			// http://man7.org/linux/man-pages/man7/epoll.7.html
			unix.Close(int(ev.Fd()))
			ce = append(ce, ev)
		} else if event.Events&(unix.EPOLLIN) != 0 {
			// Check event 'ready to read'
			re = append(re, ev)
		}
	}

	return re, ce, nil
}

func (p *epoll) wait() ([]unix.EpollEvent, error) {
	events := make([]unix.EpollEvent, MaxEvents)

	// blocking mode
	n, err := unix.EpollWait(p.fd, events, -1)
	if err != nil {
		return nil, err
	}

	return events[0:n], nil
}

// special tool for converting os specific event to interface
func toEvent(event unix.EpollEvent) Event {
	return epollEvent{event}
}

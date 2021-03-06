package flow

import (
	"context"
	"fmt"
	"strings"
)

// group is a group of steps running synchronous
type group []Step

// Group creates group of steps
// (just utility function)
func Group(steps ...Step) Step {
	// filter unusable steps
	steps = normalize(steps...)

	switch len(steps) {
	// TODO: what? what empty response?
	case 0:
		return nil
	case 1: // there is single step, no need to group
		return steps[0]
	default: // many steps, grouping this
		return group(steps)
	}
}

// Run implements Step interface
// just run one by one
func (steps group) Run(ctx context.Context) error {
	return synchronous(ctx, steps...)
}

// String implements fmt.Stringer interface
func (steps group) String() string {
	parts := make([]string, len(steps))

	for i, step := range steps {
		parts[i] = fmt.Sprintf("\t%s", step)
	}

	return fmt.Sprintf("GROUP(\n%s\n)", strings.Join(parts, ",\n"))
}

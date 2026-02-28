package session

import (
	"errors"
	"fmt"
)

// ErrTmuxNotFound is returned when tmux is not installed.
var ErrTmuxNotFound = errors.New("tmux is required for north session")

// LookPathFunc matches the signature of exec.LookPath for dependency injection.
type LookPathFunc func(name string) (string, error)

// TmuxSession describes a tmux session layout with two panes.
type TmuxSession struct {
	Name     string // session name (e.g. "north-NOR-3" or "north")
	WorkDir  string // project root
	LeftCmd  string // command for left pane (claude ...)
	RightCmd string // command for right pane (north tui)
}

// SessionName returns a tmux session name, optionally incorporating an issue ID.
func SessionName(issueID string) string {
	if issueID == "" {
		return "north"
	}
	return "north-" + issueID
}

// Args returns the tmux CLI arguments to create and attach to the session.
func (s TmuxSession) Args() []string {
	return []string{
		"new-session",
		"-s", s.Name,
		"-c", s.WorkDir,
		s.LeftCmd,
		";",
		"split-window", "-h",
		"-c", s.WorkDir,
		s.RightCmd,
		";",
		"select-pane", "-t", "0",
	}
}

// Validate checks that tmux is available.
func (s TmuxSession) Validate(lookPath LookPathFunc) error {
	if _, err := lookPath("tmux"); err != nil {
		return fmt.Errorf("%w: install tmux to use this command", ErrTmuxNotFound)
	}
	return nil
}

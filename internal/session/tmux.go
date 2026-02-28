package session

import (
	"errors"
	"fmt"
	"os/exec"
	"strings"
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

// UniqueSessionName returns a session name that doesn't conflict with existing
// tmux sessions. Appends -2, -3, etc. if the base name is taken.
func UniqueSessionName(issueID string) string {
	base := SessionName(issueID)
	if !tmuxSessionExists(base) {
		return base
	}
	for i := 2; i <= 99; i++ {
		name := fmt.Sprintf("%s-%d", base, i)
		if !tmuxSessionExists(name) {
			return name
		}
	}
	return base // give up, let tmux error
}

func tmuxSessionExists(name string) bool {
	out, err := exec.Command("tmux", "has-session", "-t", name).CombinedOutput()
	if err != nil {
		// "has-session" exits non-zero when session doesn't exist
		return false
	}
	return len(strings.TrimSpace(string(out))) == 0
}

// claudeEnvVars are env vars that Claude Code sets to detect nested sessions.
// These must be cleared from the tmux server environment so the spawned
// Claude pane doesn't refuse to start.
var claudeEnvVars = []string{
	"CLAUDECODE",
	"CLAUDE_SESSION_ID",
	"CLAUDE_CODE_ENTRYPOINT",
}

// Args returns the tmux CLI arguments to create and attach to the session.
func (s TmuxSession) Args() []string {
	args := []string{
		"new-session",
		"-s", s.Name,
		"-c", s.WorkDir,
		s.LeftCmd,
	}

	// Clear Claude Code env vars from tmux server so panes don't inherit them
	for _, v := range claudeEnvVars {
		args = append(args, ";", "set-environment", "-u", v)
	}

	args = append(args,
		";",
		"split-window", "-h",
		"-c", s.WorkDir,
		s.RightCmd,
		";",
		"select-pane", "-t", "0",
	)

	return args
}

// Validate checks that tmux is available.
func (s TmuxSession) Validate(lookPath LookPathFunc) error {
	if _, err := lookPath("tmux"); err != nil {
		return fmt.Errorf("%w: install tmux to use this command", ErrTmuxNotFound)
	}
	return nil
}

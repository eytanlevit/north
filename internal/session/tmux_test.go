package session

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestArgs_Basic(t *testing.T) {
	s := TmuxSession{
		Name:     "north",
		WorkDir:  "/home/user/project",
		LeftCmd:  "claude",
		RightCmd: "north tui",
	}

	args := s.Args()

	assert.Contains(t, args, "new-session")
	assert.Contains(t, args, "-s")
	assert.Contains(t, args, "north")
	assert.Contains(t, args, "-c")
	assert.Contains(t, args, "/home/user/project")
	assert.Contains(t, args, "claude")
	assert.Contains(t, args, "split-window")
	assert.Contains(t, args, "north tui")
	assert.Contains(t, args, "select-pane")
}

func TestArgs_WithContext(t *testing.T) {
	s := TmuxSession{
		Name:     "north-NOR-3",
		WorkDir:  "/home/user/project",
		LeftCmd:  `claude "You are working on issue NOR-3."`,
		RightCmd: "north tui",
	}

	args := s.Args()

	assert.Contains(t, args, "north-NOR-3")
	assert.Contains(t, args, `claude "You are working on issue NOR-3."`)
}

func TestArgs_SessionName(t *testing.T) {
	tests := []struct {
		name     string
		issueID  string
		expected string
	}{
		{"default", "", "north"},
		{"with issue", "NOR-3", "north-NOR-3"},
		{"another issue", "NOR-42", "north-NOR-42"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			name := SessionName(tt.issueID)
			assert.Equal(t, tt.expected, name)
		})
	}
}

func TestArgs_WorkDir(t *testing.T) {
	s := TmuxSession{
		Name:     "north",
		WorkDir:  "/custom/path",
		LeftCmd:  "claude",
		RightCmd: "north tui",
	}

	args := s.Args()

	// WorkDir should appear twice: once for new-session, once for split-window
	count := 0
	for _, a := range args {
		if a == "/custom/path" {
			count++
		}
	}
	assert.Equal(t, 2, count, "WorkDir should appear in both new-session and split-window")
}

func TestArgs_Structure(t *testing.T) {
	s := TmuxSession{
		Name:     "north",
		WorkDir:  "/proj",
		LeftCmd:  "claude",
		RightCmd: "north tui",
	}

	args := s.Args()

	// The args should form: new-session -s <name> -c <dir> <leftcmd> ; split-window -h -c <dir> <rightcmd> ; select-pane -t 0
	require.NotEmpty(t, args)
	assert.Equal(t, "new-session", args[0])

	// Find the split-window separator
	splitIdx := -1
	for i, a := range args {
		if a == "split-window" {
			splitIdx = i
			break
		}
	}
	require.Greater(t, splitIdx, 0, "should contain split-window")

	// The arg before split-window should be ";" (tmux command separator)
	assert.Equal(t, ";", args[splitIdx-1])

	// Find select-pane
	selectIdx := -1
	for i, a := range args {
		if a == "select-pane" {
			selectIdx = i
			break
		}
	}
	require.Greater(t, selectIdx, splitIdx, "select-pane should come after split-window")
	assert.Equal(t, ";", args[selectIdx-1])
}

func TestArgs_ClearsClaudeEnvVars(t *testing.T) {
	s := TmuxSession{
		Name:     "north",
		WorkDir:  "/proj",
		LeftCmd:  "claude",
		RightCmd: "north tui",
	}

	args := s.Args()

	// Should contain set-environment -u for each Claude env var
	for _, envVar := range claudeEnvVars {
		found := false
		for i, a := range args {
			if a == "set-environment" && i+2 < len(args) && args[i+1] == "-u" && args[i+2] == envVar {
				found = true
				break
			}
		}
		assert.True(t, found, "should unset %s via set-environment -u", envVar)
	}
}

func TestValidate_TmuxNotFound(t *testing.T) {
	s := TmuxSession{Name: "north", WorkDir: "/proj", LeftCmd: "claude", RightCmd: "north tui"}

	// Use a lookup func that always fails
	err := s.Validate(func(name string) (string, error) {
		return "", errors.New("not found")
	})

	require.Error(t, err)
	assert.ErrorIs(t, err, ErrTmuxNotFound)
	assert.Contains(t, err.Error(), "tmux is required")
}

func TestValidate_TmuxFound(t *testing.T) {
	s := TmuxSession{Name: "north", WorkDir: "/proj", LeftCmd: "claude", RightCmd: "north tui"}

	// Use a lookup func that succeeds
	err := s.Validate(func(name string) (string, error) {
		assert.Equal(t, "tmux", name)
		return "/usr/bin/tmux", nil
	})

	assert.NoError(t, err)
}

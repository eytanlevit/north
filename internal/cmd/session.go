package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"

	"github.com/eytanlevit/north/internal/session"
	"github.com/eytanlevit/north/internal/store"
	"github.com/spf13/cobra"
)

func NewSessionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "session [issue-id]",
		Short: "Launch tmux split with Claude Code and TUI",
		Long: `Launch a tmux session with Claude Code on the left and the
north TUI kanban board on the right. Optionally provide an issue ID
to pre-load context into Claude Code.`,
		Args: cobra.MaximumNArgs(1),
		RunE: runSession,
	}
}

func runSession(cmd *cobra.Command, args []string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	root, err := store.FindProjectRoot(cwd)
	if err != nil {
		return err
	}

	var issueID string
	if len(args) > 0 {
		issueID = args[0]
	}

	// Build context if issue ID provided
	s := store.NewFileStore(root)
	contextStr, err := session.BuildContext(s, issueID)
	if err != nil {
		return err
	}

	// Use the current binary's absolute path so tmux can find it
	// regardless of whether "north" is in PATH
	self, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve executable path: %w", err)
	}

	// Build left pane command
	leftCmd := "claude"
	if contextStr != "" {
		leftCmd = fmt.Sprintf("claude %q", contextStr)
	}

	ts := session.TmuxSession{
		Name:     session.UniqueSessionName(issueID),
		WorkDir:  root,
		LeftCmd:  leftCmd,
		RightCmd: self + " tui",
	}

	// Validate tmux is available
	if err := ts.Validate(exec.LookPath); err != nil {
		return err
	}

	// Exec into tmux (replaces current process)
	tmuxPath, _ := exec.LookPath("tmux")
	tmuxArgs := append([]string{"tmux"}, ts.Args()...)

	// Filter env vars that prevent clean launches:
	// - CLAUDECODE/CLAUDE_*: prevent Claude Code "nested session" detection
	// - TMUX: allow launching from inside an existing tmux session
	env := os.Environ()
	filtered := make([]string, 0, len(env))
	for _, e := range env {
		if strings.HasPrefix(e, "CLAUDECODE=") ||
			strings.HasPrefix(e, "CLAUDE_SESSION_ID=") ||
			strings.HasPrefix(e, "CLAUDE_CODE_ENTRYPOINT=") ||
			strings.HasPrefix(e, "TMUX=") {
			continue
		}
		filtered = append(filtered, e)
	}

	return syscall.Exec(tmuxPath, tmuxArgs, filtered)
}

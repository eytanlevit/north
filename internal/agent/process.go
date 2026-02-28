package agent

import (
	"io"
	"os"
	"os/exec"
	"strings"
)

// Agent manages a Claude Code subprocess.
type Agent struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
	events <-chan Event
	done   chan struct{}
}

// Start spawns a Claude Code subprocess in headless print mode.
func Start(initialPrompt string) (*Agent, error) {
	args := []string{
		"-p", initialPrompt,
		"--output-format", "stream-json",
		"--verbose",
	}

	cmd := exec.Command("claude", args...)
	cmd.Env = FilterEnv(os.Environ())
	cmd.Stderr = nil

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	events := Parse(stdout)
	done := make(chan struct{})

	a := &Agent{
		cmd:    cmd,
		stdin:  stdin,
		stdout: stdout,
		events: events,
		done:   done,
	}

	go func() {
		defer close(done)
		cmd.Wait()
	}()

	return a, nil
}

// Events returns the channel of parsed events from the Claude subprocess.
func (a *Agent) Events() <-chan Event {
	return a.events
}

// Send writes a message to the Claude subprocess's stdin.
func (a *Agent) Send(message string) error {
	_, err := io.WriteString(a.stdin, message+"\n")
	return err
}

// Stop terminates the Claude subprocess gracefully.
func (a *Agent) Stop() error {
	a.stdin.Close()
	<-a.done
	return nil
}

// Done returns a channel that closes when the subprocess exits.
func (a *Agent) Done() <-chan struct{} {
	return a.done
}

// FilterEnv removes env vars that interfere with Claude Code.
func FilterEnv(env []string) []string {
	filtered := make([]string, 0, len(env))
	for _, e := range env {
		if strings.HasPrefix(e, "CLAUDECODE=") ||
			strings.HasPrefix(e, "CLAUDE_SESSION_ID=") ||
			strings.HasPrefix(e, "CLAUDE_CODE_ENTRYPOINT=") {
			continue
		}
		filtered = append(filtered, e)
	}
	return filtered
}

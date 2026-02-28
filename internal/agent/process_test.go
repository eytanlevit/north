package agent

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFilterEnv(t *testing.T) {
	env := []string{
		"PATH=/usr/bin",
		"HOME=/home/user",
		"CLAUDECODE=1",
		"CLAUDE_SESSION_ID=abc123",
		"CLAUDE_CODE_ENTRYPOINT=cli",
		"GOPATH=/go",
	}
	filtered := FilterEnv(env)
	assert.Contains(t, filtered, "PATH=/usr/bin")
	assert.Contains(t, filtered, "HOME=/home/user")
	assert.Contains(t, filtered, "GOPATH=/go")
	assert.NotContains(t, filtered, "CLAUDECODE=1")
	assert.NotContains(t, filtered, "CLAUDE_SESSION_ID=abc123")
	assert.NotContains(t, filtered, "CLAUDE_CODE_ENTRYPOINT=cli")
	assert.Len(t, filtered, 3)
}

func TestFilterEnv_NoClaudeVars(t *testing.T) {
	env := []string{"PATH=/usr/bin", "HOME=/home/user"}
	filtered := FilterEnv(env)
	assert.Equal(t, env, filtered)
}

func TestFilterEnv_Empty(t *testing.T) {
	filtered := FilterEnv([]string{})
	assert.Empty(t, filtered)
}

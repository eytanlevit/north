package north_test

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var binaryPath string

func TestMain(m *testing.M) {
	// Build binary once for all e2e tests
	tmp, err := os.MkdirTemp("", "north-e2e-*")
	if err != nil {
		panic(err)
	}
	binaryPath = filepath.Join(tmp, "north")
	cmd := exec.Command("go", "build", "-o", binaryPath, "./cmd/north")
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		panic("failed to build north binary: " + err.Error())
	}

	code := m.Run()

	os.RemoveAll(tmp)
	os.Exit(code)
}

// run executes the north binary with the given args in the given dir.
func run(t *testing.T, dir string, args ...string) (string, string, int) {
	t.Helper()
	cmd := exec.Command(binaryPath, args...)
	cmd.Dir = dir
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	exitCode := 0
	if exitErr, ok := err.(*exec.ExitError); ok {
		exitCode = exitErr.ExitCode()
	} else if err != nil {
		t.Fatalf("failed to run north %v: %v", args, err)
	}
	return stdout.String(), stderr.String(), exitCode
}

func TestE2E_FullWorkflow(t *testing.T) {
	dir := t.TempDir()

	// 1. init
	stdout, _, code := run(t, dir, "init")
	require.Equal(t, 0, code, "init should succeed")
	assert.Contains(t, stdout, "Initialized")

	// Verify .north/ was created
	_, err := os.Stat(filepath.Join(dir, ".north", "config.yaml"))
	require.NoError(t, err, ".north/config.yaml should exist")

	// 2. create
	stdout, _, code = run(t, dir, "create", "My first issue")
	require.Equal(t, 0, code, "create should succeed")
	assert.Contains(t, strings.TrimSpace(stdout), "-1") // ends with -1

	// 3. create another
	stdout, _, code = run(t, dir, "create", "Second issue", "--priority", "high", "--labels", "bug,frontend")
	require.Equal(t, 0, code, "create with flags should succeed")
	assert.Contains(t, strings.TrimSpace(stdout), "-2")

	// 4. list
	stdout, _, code = run(t, dir, "list")
	require.Equal(t, 0, code, "list should succeed")
	assert.Contains(t, stdout, "My first issue")
	assert.Contains(t, stdout, "Second issue")

	// 5. list --json
	stdout, _, code = run(t, dir, "list", "--json")
	require.Equal(t, 0, code, "list --json should succeed")
	var issues []map[string]any
	require.NoError(t, json.Unmarshal([]byte(stdout), &issues), "list --json should produce valid JSON")
	assert.Len(t, issues, 2)

	// 6. show
	// Figure out the prefix from the first issue
	prefix := strings.TrimSpace(strings.Split(issues[0]["meta"].(map[string]any)["id"].(string), "-")[0])
	id1 := prefix + "-1"
	id2 := prefix + "-2"

	stdout, _, code = run(t, dir, "show", id1)
	require.Equal(t, 0, code, "show should succeed")
	assert.Contains(t, stdout, "My first issue")

	// 7. show --json
	stdout, _, code = run(t, dir, "show", id1, "--json")
	require.Equal(t, 0, code, "show --json should succeed")
	var issueJSON map[string]any
	require.NoError(t, json.Unmarshal([]byte(stdout), &issueJSON), "show --json should produce valid JSON")

	// 8. update
	stdout, _, code = run(t, dir, "update", id1, "--status", "in-progress")
	require.Equal(t, 0, code, "update should succeed")
	assert.Contains(t, stdout, "Updated")

	// Verify update took effect
	stdout, _, _ = run(t, dir, "show", id1, "--json")
	require.NoError(t, json.Unmarshal([]byte(stdout), &issueJSON))
	meta := issueJSON["meta"].(map[string]any)
	assert.Equal(t, "in-progress", meta["status"])

	// 9. comment
	stdout, _, code = run(t, dir, "comment", id1, "This is a test comment")
	require.Equal(t, 0, code, "comment should succeed")

	// Verify comment was added
	stdout, _, _ = run(t, dir, "show", id1, "--json")
	require.NoError(t, json.Unmarshal([]byte(stdout), &issueJSON))
	meta = issueJSON["meta"].(map[string]any)
	comments := meta["comments"].([]any)
	assert.Len(t, comments, 1)

	// 10. context
	stdout, _, code = run(t, dir, "context", id1)
	require.Equal(t, 0, code, "context should succeed")
	assert.Contains(t, stdout, "# Project:")
	assert.Contains(t, stdout, "# Issue:")
	assert.Contains(t, stdout, "My first issue")

	// 11. context --json
	stdout, _, code = run(t, dir, "context", id1, "--json")
	require.Equal(t, 0, code, "context --json should succeed")
	var contextJSON map[string]any
	require.NoError(t, json.Unmarshal([]byte(stdout), &contextJSON), "context --json should produce valid JSON")
	assert.Contains(t, contextJSON, "project")
	assert.Contains(t, contextJSON, "issue")

	// 12. list --status filter
	stdout, _, code = run(t, dir, "list", "--status", "in-progress", "--json")
	require.Equal(t, 0, code, "list --status filter should succeed")
	var filtered []map[string]any
	require.NoError(t, json.Unmarshal([]byte(stdout), &filtered))
	assert.Len(t, filtered, 1)

	// 13. update idempotent — updating to same status should succeed
	_, _, code = run(t, dir, "update", id1, "--status", "in-progress")
	assert.Equal(t, 0, code, "idempotent update should succeed")

	// 14. Verify second issue has labels
	stdout, _, _ = run(t, dir, "show", id2, "--json")
	require.NoError(t, json.Unmarshal([]byte(stdout), &issueJSON))
	meta = issueJSON["meta"].(map[string]any)
	labels := meta["labels"].([]any)
	assert.Contains(t, labels, "bug")
	assert.Contains(t, labels, "frontend")
}

func TestE2E_ExitCodes(t *testing.T) {
	dir := t.TempDir()

	// No project — should exit 3 (not found)
	_, _, code := run(t, dir, "list")
	assert.Equal(t, 3, code, "list without project should exit 3 (not found)")

	// Init the project first
	run(t, dir, "init")

	// Show non-existent issue — should exit 3 (not found)
	_, _, code = run(t, dir, "show", "NOR-999")
	assert.Equal(t, 3, code, "show non-existent issue should exit 3 (not found)")

	// Update non-existent issue — should exit 3 (not found)
	_, _, code = run(t, dir, "update", "NOR-999", "--status", "done")
	assert.Equal(t, 3, code, "update non-existent issue should exit 3 (not found)")

	// Create then update with invalid status — should exit 2 (validation)
	run(t, dir, "create", "Test issue")
	_, _, code = run(t, dir, "update", "NOR-1", "--status", "invalid-status")
	assert.Equal(t, 2, code, "update with invalid status should exit 2 (validation)")

	// Create with invalid priority — should exit 2 (validation)
	_, _, code = run(t, dir, "create", "Bad priority", "--priority", "super-urgent")
	assert.Equal(t, 2, code, "create with invalid priority should exit 2 (validation)")

	// Init on existing project — should exit 4 (conflict)
	_, _, code = run(t, dir, "init")
	assert.Equal(t, 4, code, "init on existing project should exit 4 (conflict)")

	// Context non-existent issue — should exit 3
	_, _, code = run(t, dir, "context", "NOR-999")
	assert.Equal(t, 3, code, "context non-existent issue should exit 3 (not found)")

	// Comment on non-existent issue — should exit 3
	_, _, code = run(t, dir, "comment", "NOR-999", "hello")
	assert.Equal(t, 3, code, "comment on non-existent issue should exit 3 (not found)")
}

func TestE2E_JSONErrors(t *testing.T) {
	dir := t.TempDir()
	run(t, dir, "init")

	// show --json for non-existent issue should output JSON error on stderr
	_, stderr, code := run(t, dir, "show", "NOR-999", "--json")
	assert.Equal(t, 3, code, "show --json non-existent should exit 3")
	if stderr != "" {
		var errJSON map[string]any
		assert.NoError(t, json.Unmarshal([]byte(stderr), &errJSON),
			"stderr should be valid JSON when --json flag is set, got: %s", stderr)
		assert.Contains(t, errJSON, "error")
		assert.Contains(t, errJSON, "code")
	} else {
		t.Error("show --json on error should output JSON error to stderr")
	}

	// context --json for non-existent issue should output JSON error on stderr
	_, stderr, code = run(t, dir, "context", "NOR-999", "--json")
	assert.Equal(t, 3, code, "context --json non-existent should exit 3")
	if stderr != "" {
		var errJSON map[string]any
		assert.NoError(t, json.Unmarshal([]byte(stderr), &errJSON),
			"stderr should be valid JSON, got: %s", stderr)
	} else {
		t.Error("context --json on error should output JSON error to stderr")
	}

	// list --json when no project exists — JSON error on stderr
	emptyDir := t.TempDir()
	_, stderr, code = run(t, emptyDir, "list", "--json")
	assert.Equal(t, 3, code, "list --json without project should exit 3")
	if stderr != "" {
		var errJSON map[string]any
		assert.NoError(t, json.Unmarshal([]byte(stderr), &errJSON),
			"stderr should be valid JSON, got: %s", stderr)
	} else {
		t.Error("list --json on error should output JSON error to stderr")
	}
}

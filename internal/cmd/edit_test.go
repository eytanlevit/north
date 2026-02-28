package cmd

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEditCmd_NoEditor(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	t.Setenv("EDITOR", "")

	cmd := NewEditCmd()
	cmd.SetArgs([]string{"NOR-1"})
	err := cmd.Execute()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "$EDITOR is not set")
}

func TestEditCmd_NotFound(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)

	editorScript := filepath.Join(t.TempDir(), "fake-editor.sh")
	require.NoError(t, os.WriteFile(editorScript, []byte("#!/bin/sh\n"), 0755))
	t.Setenv("EDITOR", editorScript)

	cmd := NewEditCmd()
	cmd.SetArgs([]string{"NOR-999"})
	err := cmd.Execute()
	assert.Error(t, err)
	assert.ErrorIs(t, err, model.ErrIssueNotFound)
}

func TestEditCmd_NotTerminal(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	editorScript := filepath.Join(t.TempDir(), "fake-editor.sh")
	require.NoError(t, os.WriteFile(editorScript, []byte("#!/bin/sh\n"), 0755))
	t.Setenv("EDITOR", editorScript)

	// isTerminal returns false in test environment by default
	cmd := NewEditCmd()
	cmd.SetArgs([]string{"NOR-1"})
	err := cmd.Execute()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "stdin is not a terminal")
}

func TestEditCmd_HappyPath(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Original Title", "todo", "medium")

	// Create a script that changes the title in the temp file
	editorScript := filepath.Join(t.TempDir(), "test-editor.sh")
	script := `#!/bin/sh
sed -i '' 's/title: Original Title/title: Edited Title/' "$1"
`
	require.NoError(t, os.WriteFile(editorScript, []byte(script), 0755))
	t.Setenv("EDITOR", editorScript)

	// Override TTY check for testing
	origIsTerminal := isTerminal
	isTerminal = func() bool { return true }
	t.Cleanup(func() { isTerminal = origIsTerminal })

	var buf bytes.Buffer
	cmd := NewEditCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-1"})
	require.NoError(t, cmd.Execute())

	assert.Contains(t, buf.String(), "Updated NOR-1")

	// Verify the title was changed
	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "Edited Title", issue.Meta.Title)
	// Other fields should be preserved
	assert.Equal(t, "todo", issue.Meta.Status)
	assert.Equal(t, "medium", issue.Meta.Priority)
}

func TestEditCmd_TitleWithColon(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Original", "todo", "medium")

	// Create a script that sets a title containing a colon (common YAML gotcha)
	editorScript := filepath.Join(t.TempDir(), "colon-editor.sh")
	script := `#!/bin/sh
sed -i '' 's/title: Original/title: "Fix: auth bug"/' "$1"
`
	require.NoError(t, os.WriteFile(editorScript, []byte(script), 0755))
	t.Setenv("EDITOR", editorScript)

	origIsTerminal := isTerminal
	isTerminal = func() bool { return true }
	t.Cleanup(func() { isTerminal = origIsTerminal })

	var buf bytes.Buffer
	cmd := NewEditCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-1"})
	require.NoError(t, cmd.Execute())

	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "Fix: auth bug", issue.Meta.Title)
}

func TestEditCmd_YAMLHintInTempFile(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	// Create a script that captures the temp file content and exits
	captureFile := filepath.Join(t.TempDir(), "captured.txt")
	editorScript := filepath.Join(t.TempDir(), "capture-editor.sh")
	script := `#!/bin/sh
cp "$1" "` + captureFile + `"
`
	require.NoError(t, os.WriteFile(editorScript, []byte(script), 0755))
	t.Setenv("EDITOR", editorScript)

	origIsTerminal := isTerminal
	isTerminal = func() bool { return true }
	t.Cleanup(func() { isTerminal = origIsTerminal })

	cmd := NewEditCmd()
	cmd.SetArgs([]string{"NOR-1"})
	require.NoError(t, cmd.Execute())

	captured, err := os.ReadFile(captureFile)
	require.NoError(t, err)
	assert.Contains(t, string(captured), "# Values with special characters (: ! { } [ ]) must be quoted",
		"temp file should contain YAML editing hint")
}

func TestEditCmd_InvalidEdit(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Original", "todo", "medium")

	// Create a script that sets an invalid status
	editorScript := filepath.Join(t.TempDir(), "bad-editor.sh")
	script := `#!/bin/sh
sed -i '' 's/status: todo/status: invalid-status/' "$1"
`
	require.NoError(t, os.WriteFile(editorScript, []byte(script), 0755))
	t.Setenv("EDITOR", editorScript)

	origIsTerminal := isTerminal
	isTerminal = func() bool { return true }
	t.Cleanup(func() { isTerminal = origIsTerminal })

	cmd := NewEditCmd()
	cmd.SetArgs([]string{"NOR-1"})
	err := cmd.Execute()
	assert.Error(t, err)
	assert.ErrorIs(t, err, model.ErrInvalidStatus)

	// Verify the original file is unchanged
	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "todo", issue.Meta.Status, "original file should be unchanged after invalid edit")
}

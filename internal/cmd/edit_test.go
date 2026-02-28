package cmd

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEditCmd_NoEditor(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	t.Setenv("EDITOR", "")

	cmd := NewEditCmd()
	cmd.SetArgs([]string{"NOR-1"})
	err := cmd.Execute()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "$EDITOR is not set")
}

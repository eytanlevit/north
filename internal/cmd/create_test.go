package cmd

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupProject(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	northDir := filepath.Join(dir, ".north")
	require.NoError(t, os.MkdirAll(filepath.Join(northDir, "issues"), 0755))
	require.NoError(t, os.MkdirAll(filepath.Join(northDir, "docs"), 0755))

	cfg := model.DefaultConfig("test")
	data, err := model.SerializeConfig(&cfg)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(northDir, "config.yaml"), data, 0644))
	return dir
}

func TestCreateCmd_BasicCreate(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))

	var buf bytes.Buffer
	cmd := NewCreateCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"My first issue"})
	require.NoError(t, cmd.Execute())

	output := strings.TrimSpace(buf.String())
	assert.Equal(t, "NOR-1", output)

	// Verify file was created
	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "My first issue", issue.Meta.Title)
	assert.Equal(t, "todo", issue.Meta.Status)
	assert.Equal(t, "medium", issue.Meta.Priority)
}

func TestCreateCmd_WithFlags(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))

	var buf bytes.Buffer
	cmd := NewCreateCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"Flagged issue", "--priority", "high", "--labels", "bug,frontend"})
	require.NoError(t, cmd.Execute())

	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "high", issue.Meta.Priority)
	assert.Contains(t, issue.Meta.Labels, "bug")
	assert.Contains(t, issue.Meta.Labels, "frontend")
}

func TestCreateCmd_SequentialIDs(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))

	for i := 0; i < 3; i++ {
		var buf bytes.Buffer
		cmd := NewCreateCmd()
		cmd.SetOut(&buf)
		cmd.SetArgs([]string{"Issue " + string(rune('A'+i))})
		require.NoError(t, cmd.Execute())
	}

	s := store.NewFileStore(dir)
	issues, err := s.ListIssues()
	require.NoError(t, err)
	require.Len(t, issues, 3)
	assert.Equal(t, "NOR-1", issues[0].Meta.ID)
	assert.Equal(t, "NOR-2", issues[1].Meta.ID)
	assert.Equal(t, "NOR-3", issues[2].Meta.ID)
}

func TestCreateCmd_InvalidPriority(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))

	cmd := NewCreateCmd()
	cmd.SetArgs([]string{"Bad priority", "--priority", "urgent"})
	err := cmd.Execute()
	assert.Error(t, err)
	assert.ErrorIs(t, err, model.ErrInvalidPriority)
}

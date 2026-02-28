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

func TestUpdateCmd_Status(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	var buf bytes.Buffer
	cmd := NewUpdateCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-1", "--status", "done"})
	require.NoError(t, cmd.Execute())

	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "done", issue.Meta.Status)
}

func TestUpdateCmd_PreservesBody(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))

	// Write issue with body
	issue := &model.Issue{
		Meta: model.IssueMeta{
			FormatVersion: 1,
			ID:            "NOR-1",
			Title:         "With body",
			Status:        "todo",
			Priority:      "medium",
			Created:       "2026-02-28",
			Updated:       "2026-02-28",
		},
		Body: "\n## Description\n\nImportant content here.\n",
	}
	data, err := model.SerializeIssue(issue)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(dir, ".north", "issues", "NOR-1.md"), data, 0644))

	cmd := NewUpdateCmd()
	cmd.SetOut(&bytes.Buffer{})
	cmd.SetArgs([]string{"NOR-1", "--status", "done"})
	require.NoError(t, cmd.Execute())

	s := store.NewFileStore(dir)
	updated, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "done", updated.Meta.Status)
	assert.Equal(t, "\n## Description\n\nImportant content here.\n", updated.Body)
}

func TestUpdateCmd_InvalidStatus(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	cmd := NewUpdateCmd()
	cmd.SetArgs([]string{"NOR-1", "--status", "invalid"})
	err := cmd.Execute()
	assert.ErrorIs(t, err, model.ErrInvalidStatus)
}

func TestUpdateCmd_MultipleFields(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))
	writeIssue(t, dir, "NOR-1", "Old title", "todo", "medium")

	cmd := NewUpdateCmd()
	cmd.SetOut(&bytes.Buffer{})
	cmd.SetArgs([]string{"NOR-1", "--title", "New title", "--priority", "high", "--labels", "bug"})
	require.NoError(t, cmd.Execute())

	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "New title", issue.Meta.Title)
	assert.Equal(t, "high", issue.Meta.Priority)
	assert.Contains(t, issue.Meta.Labels, "bug")
}

func TestUpdateCmd_NotFound(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))

	cmd := NewUpdateCmd()
	cmd.SetArgs([]string{"NOR-999", "--status", "done"})
	err := cmd.Execute()
	assert.ErrorIs(t, err, model.ErrIssueNotFound)
}

func TestUpdateCmd_NoFlags(t *testing.T) {
	dir := setupProject(t)
	require.NoError(t, os.Chdir(dir))
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	cmd := NewUpdateCmd()
	cmd.SetArgs([]string{"NOR-1"})
	err := cmd.Execute()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no update flags provided")
}

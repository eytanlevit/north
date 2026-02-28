package cmd

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func writeIssue(t *testing.T, dir string, id, title, status, priority string) {
	t.Helper()
	issue := &model.Issue{
		Meta: model.IssueMeta{
			FormatVersion: 1,
			ID:            id,
			Title:         title,
			Status:        status,
			Priority:      priority,
			Created:       "2026-02-28",
			Updated:       "2026-02-28",
		},
	}
	data, err := model.SerializeIssue(issue)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(dir, ".north", "issues", id+".md"), data, 0644))
}

func TestListCmd_Table(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "First", "todo", "high")
	writeIssue(t, dir, "NOR-2", "Second", "done", "low")

	var buf bytes.Buffer
	cmd := NewListCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{})
	require.NoError(t, cmd.Execute())

	out := buf.String()
	assert.Contains(t, out, "NOR-1")
	assert.Contains(t, out, "NOR-2")
	assert.Contains(t, out, "First")
	assert.Contains(t, out, "Second")
}

func TestListCmd_JSON(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "First", "todo", "high")

	var buf bytes.Buffer
	cmd := NewListCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"--json"})
	require.NoError(t, cmd.Execute())

	var result []map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &result))
	assert.Len(t, result, 1)
}

func TestListCmd_JSONEmpty(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)

	var buf bytes.Buffer
	cmd := NewListCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"--json"})
	require.NoError(t, cmd.Execute())

	var result []map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &result))
	assert.NotNil(t, result)
	assert.Len(t, result, 0)
}

func TestListCmd_MalformedIssueFile(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Good issue", "todo", "medium")

	// Write a malformed issue file
	require.NoError(t, os.WriteFile(
		filepath.Join(dir, ".north", "issues", "NOR-2.md"),
		[]byte("this is not valid frontmatter"),
		0644,
	))

	cmd := NewListCmd()
	cmd.SetArgs([]string{})
	err := cmd.Execute()
	// ListIssues currently fails on malformed files — this test documents that behavior
	assert.Error(t, err, "list should fail when an issue file is malformed")
}

func TestListCmd_StatusFilter(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Todo item", "todo", "medium")
	writeIssue(t, dir, "NOR-2", "Done item", "done", "medium")

	var buf bytes.Buffer
	cmd := NewListCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"--status", "todo"})
	require.NoError(t, cmd.Execute())

	out := buf.String()
	assert.Contains(t, out, "NOR-1")
	assert.NotContains(t, out, "NOR-2")
}

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

// writeIssueWithDate creates an issue file with a specific updated date.
func writeIssueWithDate(t *testing.T, dir string, id, title, status, priority, updated string) {
	t.Helper()
	issue := &model.Issue{
		Meta: model.IssueMeta{
			FormatVersion: 1,
			ID:            id,
			Title:         title,
			Status:        status,
			Priority:      priority,
			Created:       updated,
			Updated:       updated,
		},
	}
	data, err := model.SerializeIssue(issue)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(dir, ".north", "issues", id+".md"), data, 0644))
}

func TestStaleCmd_HappyPath(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssueWithDate(t, dir, "NOR-1", "Old issue", "todo", "medium", "2025-01-01")
	writeIssueWithDate(t, dir, "NOR-2", "Fresh issue", "in-progress", "high", "2026-02-28")

	var buf bytes.Buffer
	cmd := NewStaleCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{})
	require.NoError(t, cmd.Execute())

	out := buf.String()
	assert.Contains(t, out, "NOR-1")
	assert.Contains(t, out, "Old issue")
	assert.NotContains(t, out, "NOR-2") // fresh issue should not appear
}

func TestStaleCmd_JSON(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssueWithDate(t, dir, "NOR-1", "Old issue", "todo", "medium", "2025-01-01")
	writeIssueWithDate(t, dir, "NOR-2", "Fresh issue", "in-progress", "high", "2026-02-28")

	var buf bytes.Buffer
	cmd := NewStaleCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"--json"})
	require.NoError(t, cmd.Execute())

	var result []staleIssue
	require.NoError(t, json.Unmarshal(buf.Bytes(), &result))
	require.Len(t, result, 1)
	assert.Equal(t, "NOR-1", result[0].ID)
	assert.Greater(t, result[0].DaysStale, 0)
}

func TestStaleCmd_CustomDays(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssueWithDate(t, dir, "NOR-1", "Old issue", "todo", "medium", "2025-01-01")

	var buf bytes.Buffer
	cmd := NewStaleCmd()
	cmd.SetOut(&buf)
	// Use a very large days value - nothing should be stale
	cmd.SetArgs([]string{"--days", "99999"})
	require.NoError(t, cmd.Execute())

	assert.Contains(t, buf.String(), "No stale issues found")
}

func TestStaleCmd_NoStaleIssues(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssueWithDate(t, dir, "NOR-1", "Fresh", "todo", "medium", "2026-02-28")

	var buf bytes.Buffer
	cmd := NewStaleCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{})
	require.NoError(t, cmd.Execute())

	assert.Contains(t, buf.String(), "No stale issues found")
}

func TestStaleCmd_EmptyJSON(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssueWithDate(t, dir, "NOR-1", "Fresh", "todo", "medium", "2026-02-28")

	var buf bytes.Buffer
	cmd := NewStaleCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"--json"})
	require.NoError(t, cmd.Execute())

	var result []staleIssue
	require.NoError(t, json.Unmarshal(buf.Bytes(), &result))
	assert.NotNil(t, result)
	assert.Len(t, result, 0) // empty array, not null
}

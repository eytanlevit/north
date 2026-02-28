package cmd

import (
	"bytes"
	"testing"

	"github.com/eytanlevit/north/internal/model"
	"github.com/eytanlevit/north/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCommentCmd_Basic(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	var buf bytes.Buffer
	cmd := NewCommentCmd()
	cmd.SetOut(&buf)
	cmd.SetArgs([]string{"NOR-1", "This is a comment", "--author", "test-user"})
	require.NoError(t, cmd.Execute())

	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	require.Len(t, issue.Meta.Comments, 1)
	assert.Equal(t, "test-user", issue.Meta.Comments[0].Author)
	assert.Equal(t, "This is a comment", issue.Meta.Comments[0].Body)
}

func TestCommentCmd_MultipleComments(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	for i, msg := range []string{"First", "Second", "Third"} {
		cmd := NewCommentCmd()
		cmd.SetOut(&bytes.Buffer{})
		cmd.SetArgs([]string{"NOR-1", msg, "--author", "user"})
		require.NoError(t, cmd.Execute(), "comment %d", i)
	}

	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	require.Len(t, issue.Meta.Comments, 3)
	assert.Equal(t, "First", issue.Meta.Comments[0].Body)
	assert.Equal(t, "Third", issue.Meta.Comments[2].Body)
}

func TestCommentCmd_AuthorFromEnv(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	t.Setenv("NORTH_AUTHOR", "env-author")

	cmd := NewCommentCmd()
	cmd.SetOut(&bytes.Buffer{})
	cmd.SetArgs([]string{"NOR-1", "From env"})
	require.NoError(t, cmd.Execute())

	s := store.NewFileStore(dir)
	issue, err := s.LoadIssue("NOR-1")
	require.NoError(t, err)
	assert.Equal(t, "env-author", issue.Meta.Comments[0].Author)
}

func TestCommentCmd_NotFound(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)

	cmd := NewCommentCmd()
	cmd.SetArgs([]string{"NOR-999", "msg"})
	err := cmd.Execute()
	assert.ErrorIs(t, err, model.ErrIssueNotFound)
}

func TestCommentCmd_NoMessage(t *testing.T) {
	dir := setupProject(t)
	chdir(t, dir)
	writeIssue(t, dir, "NOR-1", "Test", "todo", "medium")

	cmd := NewCommentCmd()
	cmd.SetArgs([]string{"NOR-1"})
	err := cmd.Execute()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "comment message required")
}

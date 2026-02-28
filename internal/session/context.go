package session

import (
	"bytes"
	"fmt"

	"github.com/eytanlevit/north/internal/render"
	"github.com/eytanlevit/north/internal/store"
)

// BuildContext generates a context string for Claude Code from an issue.
// Returns empty string if issueID is empty.
func BuildContext(s store.Store, issueID string) (string, error) {
	if issueID == "" {
		return "", nil
	}

	cfg, err := s.LoadConfig()
	if err != nil {
		return "", err
	}

	issue, err := s.LoadIssue(issueID)
	if err != nil {
		return "", err
	}

	data := &render.ContextData{
		Project: cfg,
		Issue:   issue,
	}

	// Load blocking issues
	for _, blockerID := range issue.Meta.BlockedBy {
		blocker, err := s.LoadIssue(blockerID)
		if err != nil {
			continue
		}
		data.BlockingIssues = append(data.BlockingIssues, blocker)
	}

	// Load parent issue
	if issue.Meta.Parent != "" {
		parent, err := s.LoadIssue(issue.Meta.Parent)
		if err == nil {
			data.ParentIssue = parent
		}
	}

	// Load documents
	data.Documents = render.LoadDocuments(issue, s.ProjectRoot())

	var buf bytes.Buffer
	render.ContextMarkdown(&buf, data, s.ProjectRoot())

	return fmt.Sprintf("You are working on issue %s. Here is the full context:\n\n%s", issueID, buf.String()), nil
}

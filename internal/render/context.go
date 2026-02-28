package render

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/eytanlevit/north/internal/model"
)

// ContextData holds all data for the context command output.
type ContextData struct {
	Project       *model.Config  `json:"project"`
	Issue         *model.Issue   `json:"issue"`
	BlockingIssues []*model.Issue `json:"blocking_issues,omitempty"`
	ParentIssue   *model.Issue   `json:"parent_issue,omitempty"`
	Documents     []DocContent   `json:"documents,omitempty"`
}

// DocContent holds a document path and its contents.
type DocContent struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// ContextMarkdown writes the context output in markdown format.
func ContextMarkdown(w io.Writer, data *ContextData, projectRoot string) {
	// Project section
	fmt.Fprintf(w, "# Project: %s\n", data.Project.Project)
	fmt.Fprintln(w)

	// Issue section
	issue := data.Issue
	fmt.Fprintf(w, "# Issue: %s — %s\n", issue.Meta.ID, issue.Meta.Title)
	fmt.Fprintf(w, "Status: %s | Priority: %s", issue.Meta.Status, issue.Meta.Priority)
	if len(issue.Meta.Labels) > 0 {
		fmt.Fprintf(w, " | Labels: %s", strings.Join(issue.Meta.Labels, ", "))
	}
	fmt.Fprintln(w)

	// Body
	if issue.Body != "" {
		fmt.Fprint(w, issue.Body)
	}

	// Comments
	if len(issue.Meta.Comments) > 0 {
		fmt.Fprintf(w, "\n## Comments (%d)\n", len(issue.Meta.Comments))
		for _, c := range issue.Meta.Comments {
			fmt.Fprintf(w, "[%s %s] %s\n", c.Date, c.Author, strings.TrimSpace(c.Body))
		}
	}

	// Blocking issues
	if len(data.BlockingIssues) > 0 {
		fmt.Fprintln(w)
		fmt.Fprintln(w, "# Blocking Issues")
		for _, bi := range data.BlockingIssues {
			fmt.Fprintf(w, "## %s — %s\n", bi.Meta.ID, bi.Meta.Title)
			fmt.Fprintf(w, "Status: %s | Priority: %s\n", bi.Meta.Status, bi.Meta.Priority)
		}
	}

	// Parent issue
	if data.ParentIssue != nil {
		fmt.Fprintln(w)
		fmt.Fprintln(w, "# Related Issues (parent)")
		fmt.Fprintf(w, "## %s — %s\n", data.ParentIssue.Meta.ID, data.ParentIssue.Meta.Title)
		fmt.Fprintf(w, "Status: %s | Priority: %s\n", data.ParentIssue.Meta.Status, data.ParentIssue.Meta.Priority)
	}

	// Documents
	if len(data.Documents) > 0 {
		fmt.Fprintln(w)
		fmt.Fprintln(w, "# Documents")
		for _, doc := range data.Documents {
			fmt.Fprintf(w, "## %s\n", doc.Path)
			fmt.Fprintln(w, doc.Content)
		}
	}
}

// LoadDocuments reads document files referenced in the issue's docs field.
func LoadDocuments(issue *model.Issue, projectRoot string) []DocContent {
	var docs []DocContent
	for _, docPath := range issue.Meta.Docs {
		fullPath := filepath.Join(projectRoot, ".north", docPath)
		data, err := os.ReadFile(fullPath)
		if err != nil {
			continue // Skip missing docs
		}
		docs = append(docs, DocContent{
			Path:    docPath,
			Content: string(data),
		})
	}
	return docs
}

package render

import (
	"fmt"
	"io"
	"strings"
	"text/tabwriter"

	"github.com/eytanlevit/north/internal/model"
)

// IssueTable writes a formatted table of issues to w.
func IssueTable(w io.Writer, issues []*model.Issue) {
	if len(issues) == 0 {
		fmt.Fprintln(w, "No issues found.")
		return
	}

	tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "ID\tSTATUS\tPRIORITY\tTITLE\tLABELS")
	for _, issue := range issues {
		labels := strings.Join(issue.Meta.Labels, ", ")
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\n",
			issue.Meta.ID,
			issue.Meta.Status,
			issue.Meta.Priority,
			issue.Meta.Title,
			labels,
		)
	}
	tw.Flush()
}

// IssueDetail writes a detailed view of a single issue to w.
func IssueDetail(w io.Writer, issue *model.Issue) {
	fmt.Fprintf(w, "ID:       %s\n", issue.Meta.ID)
	fmt.Fprintf(w, "Title:    %s\n", issue.Meta.Title)
	fmt.Fprintf(w, "Status:   %s\n", issue.Meta.Status)
	fmt.Fprintf(w, "Priority: %s\n", issue.Meta.Priority)
	if len(issue.Meta.Labels) > 0 {
		fmt.Fprintf(w, "Labels:   %s\n", strings.Join(issue.Meta.Labels, ", "))
	}
	if issue.Meta.Parent != "" {
		fmt.Fprintf(w, "Parent:   %s\n", issue.Meta.Parent)
	}
	if len(issue.Meta.BlockedBy) > 0 {
		fmt.Fprintf(w, "Blocked:  %s\n", strings.Join(issue.Meta.BlockedBy, ", "))
	}
	fmt.Fprintf(w, "Created:  %s\n", issue.Meta.Created)
	fmt.Fprintf(w, "Updated:  %s\n", issue.Meta.Updated)

	if issue.Body != "" {
		fmt.Fprintln(w)
		fmt.Fprint(w, issue.Body)
	}

	if len(issue.Meta.Comments) > 0 {
		fmt.Fprintf(w, "\nComments (%d):\n", len(issue.Meta.Comments))
		for _, c := range issue.Meta.Comments {
			fmt.Fprintf(w, "[%s %s] %s\n", c.Date, c.Author, strings.TrimSpace(c.Body))
		}
	}
}

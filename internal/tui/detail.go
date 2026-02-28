package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"
	"github.com/eytanlevit/north/internal/model"
)

// DetailModel shows a scrollable detail view for a single issue.
type DetailModel struct {
	issue    *model.Issue
	viewport viewport.Model
	ready    bool
	width    int
	height   int
}

// NewDetailModel creates a new detail view.
func NewDetailModel() DetailModel {
	return DetailModel{}
}

// SetIssue sets the issue to display and rebuilds viewport content.
func (d *DetailModel) SetIssue(issue *model.Issue) {
	d.issue = issue
	d.rebuildContent()
}

// SetSize updates dimensions and rebuilds the viewport.
func (d *DetailModel) SetSize(w, h int) {
	d.width = w
	d.height = h

	// Header takes ~8 lines, help bar 2 lines.
	vpHeight := max(1, h-10)
	vpWidth := max(1, w-2)

	if !d.ready {
		d.viewport = viewport.New(vpWidth, vpHeight)
		d.ready = true
	} else {
		d.viewport.Width = vpWidth
		d.viewport.Height = vpHeight
	}

	d.rebuildContent()
}

func (d *DetailModel) rebuildContent() {
	if d.issue == nil || !d.ready {
		return
	}

	contentWidth := max(1, d.width-4)
	var b strings.Builder

	// Body.
	if d.issue.Body != "" {
		b.WriteString(wordWrap(strings.TrimSpace(d.issue.Body), contentWidth))
		b.WriteString("\n")
	}

	// Comments.
	if len(d.issue.Meta.Comments) > 0 {
		b.WriteString("\n")
		b.WriteString(detailHeaderStyle.Render(fmt.Sprintf("Comments (%d)", len(d.issue.Meta.Comments))))
		b.WriteString("\n")
		for _, c := range d.issue.Meta.Comments {
			header := lipgloss.NewStyle().Foreground(colorMuted).Render(
				fmt.Sprintf("[%s %s]", c.Date, c.Author),
			)
			b.WriteString(header + "\n")
			b.WriteString(wordWrap(strings.TrimSpace(c.Body), contentWidth))
			b.WriteString("\n\n")
		}
	}

	d.viewport.SetContent(b.String())
}

// View renders the detail view.
func (d *DetailModel) View() string {
	if d.issue == nil {
		return emptyStyle.Render("No issue selected.")
	}

	var b strings.Builder

	// Header.
	title := detailHeaderStyle.Render(fmt.Sprintf("%s: %s", d.issue.Meta.ID, d.issue.Meta.Title))
	b.WriteString(title)
	b.WriteString("\n")

	// Metadata fields.
	b.WriteString(metaLine("Status", d.issue.Meta.Status))
	b.WriteString(metaLine("Priority", PriorityIndicator(d.issue.Meta.Priority)+" "+d.issue.Meta.Priority))
	if len(d.issue.Meta.Labels) > 0 {
		b.WriteString(metaLine("Labels", strings.Join(d.issue.Meta.Labels, ", ")))
	}
	if d.issue.Meta.Parent != "" {
		b.WriteString(metaLine("Parent", d.issue.Meta.Parent))
	}
	if len(d.issue.Meta.BlockedBy) > 0 {
		b.WriteString(metaLine("Blocked by", strings.Join(d.issue.Meta.BlockedBy, ", ")))
	}
	b.WriteString(metaLine("Created", d.issue.Meta.Created))
	b.WriteString(metaLine("Updated", d.issue.Meta.Updated))
	b.WriteString("\n")

	// Scrollable body.
	if d.ready {
		b.WriteString(d.viewport.View())
	}

	return b.String()
}

// ScrollUp scrolls the viewport up.
func (d *DetailModel) ScrollUp() {
	if d.ready {
		d.viewport.LineUp(1)
	}
}

// ScrollDown scrolls the viewport down.
func (d *DetailModel) ScrollDown() {
	if d.ready {
		d.viewport.LineDown(1)
	}
}

func metaLine(label, value string) string {
	return detailLabelStyle.Render(label+":") + " " + detailValueStyle.Render(value) + "\n"
}

func wordWrap(s string, width int) string {
	if width <= 0 {
		return s
	}
	var result strings.Builder
	for _, line := range strings.Split(s, "\n") {
		if len(line) <= width {
			result.WriteString(line)
			result.WriteString("\n")
			continue
		}
		for len(line) > width {
			// Find last space within width.
			idx := strings.LastIndex(line[:width], " ")
			if idx <= 0 {
				idx = width
			}
			result.WriteString(line[:idx])
			result.WriteString("\n")
			line = strings.TrimLeft(line[idx:], " ")
		}
		if line != "" {
			result.WriteString(line)
			result.WriteString("\n")
		}
	}
	return strings.TrimRight(result.String(), "\n")
}

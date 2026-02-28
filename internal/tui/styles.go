package tui

import "github.com/charmbracelet/lipgloss"

// Colors — adaptive for dark/light terminals.
var (
	colorPrimary   = lipgloss.AdaptiveColor{Light: "#5A56E0", Dark: "#7571F9"}
	colorSecondary = lipgloss.AdaptiveColor{Light: "#2B2D42", Dark: "#8D99AE"}
	colorMuted     = lipgloss.AdaptiveColor{Light: "#999999", Dark: "#666666"}
	colorHighlight = lipgloss.AdaptiveColor{Light: "#FFFFFF", Dark: "#FFFFFF"}
	colorBorder    = lipgloss.AdaptiveColor{Light: "#DDDDDD", Dark: "#444444"}
	colorFocusBdr  = lipgloss.AdaptiveColor{Light: "#5A56E0", Dark: "#7571F9"}

	// Priority colors.
	colorCritical = lipgloss.AdaptiveColor{Light: "#D32F2F", Dark: "#EF5350"}
	colorHigh     = lipgloss.AdaptiveColor{Light: "#E65100", Dark: "#FF9800"}
	colorMedium   = lipgloss.AdaptiveColor{Light: "#1565C0", Dark: "#42A5F5"}
	colorLow      = lipgloss.AdaptiveColor{Light: "#2E7D32", Dark: "#66BB6A"}
)

// Column styles.
var (
	columnStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorBorder).
			Padding(0, 1)

	focusedColumnStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(colorFocusBdr).
				Padding(0, 1)

	columnTitleStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(colorSecondary).
				Padding(0, 0, 1, 0)

	focusedColumnTitleStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(colorPrimary).
				Padding(0, 0, 1, 0)
)

// Card styles.
var (
	cardStyle = lipgloss.NewStyle().
			Padding(0, 1).
			MarginBottom(1)

	selectedCardStyle = lipgloss.NewStyle().
				Padding(0, 1).
				MarginBottom(1).
				Bold(true).
				Foreground(colorHighlight).
				Background(colorPrimary)

	cardIDStyle = lipgloss.NewStyle().
			Foreground(colorMuted)

	cardTitleStyle = lipgloss.NewStyle()
)

// Detail view styles.
var (
	detailHeaderStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(colorPrimary).
				Padding(0, 0, 1, 0)

	detailLabelStyle = lipgloss.NewStyle().
				Foreground(colorMuted).
				Width(12)

	detailValueStyle = lipgloss.NewStyle()
)

// Help bar style.
var helpStyle = lipgloss.NewStyle().
	Foreground(colorMuted).
	Padding(1, 0, 0, 0)

// Empty state.
var emptyStyle = lipgloss.NewStyle().
	Foreground(colorMuted).
	Italic(true).
	Padding(1, 2)

// PriorityIndicator returns a colored symbol for the priority level.
func PriorityIndicator(priority string) string {
	switch priority {
	case "critical":
		return lipgloss.NewStyle().Foreground(colorCritical).Render("●")
	case "high":
		return lipgloss.NewStyle().Foreground(colorHigh).Render("●")
	case "medium":
		return lipgloss.NewStyle().Foreground(colorMedium).Render("●")
	case "low":
		return lipgloss.NewStyle().Foreground(colorLow).Render("●")
	default:
		return lipgloss.NewStyle().Foreground(colorMuted).Render("○")
	}
}

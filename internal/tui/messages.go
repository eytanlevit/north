package tui

import "github.com/eytanlevit/north/internal/model"

// issuesLoadedMsg is sent when issues have been loaded from the store.
type issuesLoadedMsg struct {
	issues []*model.Issue
	err    error
}

// configLoadedMsg is sent when config has been loaded from the store.
type configLoadedMsg struct {
	config *model.Config
	err    error
}

// filesChangedMsg is sent when the fsnotify watcher detects issue file changes.
type filesChangedMsg struct{}

// errMsg wraps an error as a tea.Msg.
type errMsg struct {
	err error
}

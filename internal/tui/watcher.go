package tui

import (
	"path/filepath"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/fsnotify/fsnotify"
)

// watchCmd creates a tea.Cmd that blocks until an issue file changes.
// Uses single-shot re-arm pattern: returns one filesChangedMsg per event batch.
func watchCmd(projectRoot string) tea.Cmd {
	return func() tea.Msg {
		issuesDir := filepath.Join(projectRoot, ".north", "issues")

		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			return errMsg{err: err}
		}
		defer watcher.Close()

		if err := watcher.Add(issuesDir); err != nil {
			return errMsg{err: err}
		}

		// Debounce: wait for 100ms of silence after first event.
		var debounce <-chan time.Time
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return nil
				}
				// Only react to .md file changes.
				if !strings.HasSuffix(event.Name, ".md") {
					continue
				}
				// Start/reset debounce timer.
				debounce = time.After(100 * time.Millisecond)

			case err, ok := <-watcher.Errors:
				if !ok {
					return nil
				}
				return errMsg{err: err}

			case <-debounce:
				return filesChangedMsg{}
			}
		}
	}
}

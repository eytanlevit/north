package store

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/eytanlevit/north/internal/model"
	"github.com/gofrs/flock"
)

// Store defines the interface for issue storage operations.
type Store interface {
	ProjectRoot() string
	LoadConfig() (*model.Config, error)
	SaveConfig(cfg *model.Config) error
	LoadIssue(id string) (*model.Issue, error)
	SaveIssue(issue *model.Issue) error
	ListIssues() ([]*model.Issue, error)
	NextID() (string, error)
}

// FileStore implements Store using the local filesystem.
type FileStore struct {
	root string
}

// NewFileStore creates a store rooted at the given directory.
func NewFileStore(root string) *FileStore {
	return &FileStore{root: root}
}

// FindProjectRoot walks up from startDir looking for a .north/ directory.
// Stops at filesystem root or $HOME. Returns ErrProjectNotFound if not found.
func FindProjectRoot(startDir string) (string, error) {
	home, _ := os.UserHomeDir()
	dir, err := filepath.Abs(startDir)
	if err != nil {
		return "", err
	}

	for {
		if info, err := os.Stat(filepath.Join(dir, ".north")); err == nil && info.IsDir() {
			return dir, nil
		}

		// Stop at home directory or filesystem root
		if dir == home {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break // filesystem root
		}
		dir = parent
	}

	return "", model.ErrProjectNotFound
}

func (fs *FileStore) ProjectRoot() string {
	return fs.root
}

func (fs *FileStore) northDir() string {
	return filepath.Join(fs.root, ".north")
}

func (fs *FileStore) issuesDir() string {
	return filepath.Join(fs.northDir(), "issues")
}

func (fs *FileStore) configPath() string {
	return filepath.Join(fs.northDir(), "config.yaml")
}

func (fs *FileStore) lockPath() string {
	return filepath.Join(fs.northDir(), ".lock")
}

func (fs *FileStore) withLock(fn func() error) error {
	fl := flock.New(fs.lockPath())
	if err := fl.Lock(); err != nil {
		return fmt.Errorf("acquire lock: %w", err)
	}
	defer fl.Unlock()
	return fn()
}

func (fs *FileStore) LoadConfig() (*model.Config, error) {
	data, err := os.ReadFile(fs.configPath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, model.ErrProjectNotFound
		}
		return nil, fmt.Errorf("read config: %w", err)
	}
	return model.ParseConfig(data)
}

func (fs *FileStore) SaveConfig(cfg *model.Config) error {
	data, err := model.SerializeConfig(cfg)
	if err != nil {
		return err
	}
	return AtomicWriteFile(fs.configPath(), data, 0644)
}

func (fs *FileStore) issueFilePath(id string) string {
	return filepath.Join(fs.issuesDir(), id+".md")
}

func (fs *FileStore) LoadIssue(id string) (*model.Issue, error) {
	data, err := os.ReadFile(fs.issueFilePath(id))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, model.ErrIssueNotFound
		}
		return nil, fmt.Errorf("read issue %s: %w", id, err)
	}
	return model.ParseIssue(data)
}

func (fs *FileStore) SaveIssue(issue *model.Issue) error {
	data, err := model.SerializeIssue(issue)
	if err != nil {
		return err
	}
	return fs.withLock(func() error {
		return AtomicWriteFile(fs.issueFilePath(issue.Meta.ID), data, 0644)
	})
}

func (fs *FileStore) ListIssues() ([]*model.Issue, error) {
	entries, err := os.ReadDir(fs.issuesDir())
	if err != nil {
		if os.IsNotExist(err) {
			return []*model.Issue{}, nil
		}
		return nil, fmt.Errorf("read issues dir: %w", err)
	}

	var issues []*model.Issue
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(fs.issuesDir(), e.Name()))
		if err != nil {
			return nil, fmt.Errorf("read issue %s: %w", e.Name(), err)
		}
		issue, err := model.ParseIssue(data)
		if err != nil {
			return nil, fmt.Errorf("parse issue %s: %w", e.Name(), err)
		}
		issues = append(issues, issue)
	}

	sort.Slice(issues, func(i, j int) bool {
		ni, _ := model.IDNumber(issues[i].Meta.ID)
		nj, _ := model.IDNumber(issues[j].Meta.ID)
		return ni < nj
	})

	if issues == nil {
		issues = []*model.Issue{}
	}

	return issues, nil
}

func (fs *FileStore) NextID() (string, error) {
	cfg, err := fs.LoadConfig()
	if err != nil {
		return "", err
	}

	var nextID string
	err = fs.withLock(func() error {
		entries, err := os.ReadDir(fs.issuesDir())
		if err != nil {
			if os.IsNotExist(err) {
				nextID = fmt.Sprintf("%s-1", cfg.Prefix)
				return nil
			}
			return fmt.Errorf("read issues dir: %w", err)
		}

		maxNum := 0
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
				continue
			}
			id := strings.TrimSuffix(e.Name(), ".md")
			n, err := model.IDNumber(id)
			if err != nil {
				continue
			}
			if n > maxNum {
				maxNum = n
			}
		}

		nextID = fmt.Sprintf("%s-%d", cfg.Prefix, maxNum+1)
		return nil
	})

	return nextID, err
}

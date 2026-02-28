package model

import (
	"bytes"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"gopkg.in/yaml.v3"
)

// Comment represents a structured comment in issue frontmatter.
type Comment struct {
	Author string `yaml:"author"`
	Date   string `yaml:"date"`
	Body   string `yaml:"body"`
}

// IssueMeta is the YAML frontmatter of an issue file.
type IssueMeta struct {
	FormatVersion int       `yaml:"format_version"`
	ID            string    `yaml:"id"`
	Title         string    `yaml:"title"`
	Status        string    `yaml:"status"`
	Priority      string    `yaml:"priority"`
	Labels        []string  `yaml:"labels,omitempty,flow"`
	Parent        string    `yaml:"parent,omitempty"`
	BlockedBy     []string  `yaml:"blocked_by,omitempty,flow"`
	Docs          []string  `yaml:"docs,omitempty,flow"`
	Created       string    `yaml:"created"`
	Updated       string    `yaml:"updated"`
	Comments      []Comment `yaml:"comments,omitempty"`
}

// Issue combines frontmatter metadata with the markdown body.
type Issue struct {
	Meta IssueMeta
	Body string
}

var idPattern = regexp.MustCompile(`^[A-Z]+-\d+$`)

// ParseIssue parses an issue file (frontmatter + body) from raw bytes.
func ParseIssue(data []byte) (*Issue, error) {
	s := string(data)

	// Must start with ---
	if !strings.HasPrefix(s, "---\n") {
		return nil, fmt.Errorf("missing opening frontmatter delimiter")
	}

	// Find closing ---
	rest := s[4:] // skip "---\n"
	idx := strings.Index(rest, "\n---\n")
	if idx < 0 {
		// Check if it ends with \n---
		if strings.HasSuffix(rest, "\n---") {
			idx = len(rest) - 4
		} else {
			return nil, fmt.Errorf("missing closing frontmatter delimiter")
		}
	}

	// Include trailing newline in YAML so block scalars parse correctly
	yamlStr := rest[:idx+1]
	body := ""
	// "\n---\n" is 5 chars; body starts after it
	endOfDelimiter := 4 + idx + 5
	if endOfDelimiter <= len(s) {
		body = s[endOfDelimiter:]
	}

	var meta IssueMeta
	if err := yaml.Unmarshal([]byte(yamlStr), &meta); err != nil {
		return nil, fmt.Errorf("invalid frontmatter YAML: %w", err)
	}

	return &Issue{Meta: meta, Body: body}, nil
}

// SerializeIssue serializes an issue back to frontmatter + body format.
func SerializeIssue(issue *Issue) ([]byte, error) {
	// Sort labels for deterministic output
	meta := issue.Meta
	if len(meta.Labels) > 0 {
		sorted := make([]string, len(meta.Labels))
		copy(sorted, meta.Labels)
		slices.Sort(sorted)
		meta.Labels = sorted
	}

	yamlBytes, err := yaml.Marshal(&meta)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal frontmatter: %w", err)
	}

	var buf bytes.Buffer
	buf.WriteString("---\n")
	buf.Write(yamlBytes)
	buf.WriteString("---\n")
	buf.WriteString(issue.Body)

	return buf.Bytes(), nil
}

// ValidateIssue checks that an issue's fields are valid against the config.
func ValidateIssue(issue *Issue, cfg *Config) error {
	if issue.Meta.Title == "" {
		return fmt.Errorf("%w: title must not be empty", ErrInvalidID)
	}

	if !idPattern.MatchString(issue.Meta.ID) {
		return fmt.Errorf("%w: %q", ErrInvalidID, issue.Meta.ID)
	}

	if !slices.Contains(cfg.Statuses, issue.Meta.Status) {
		return fmt.Errorf("%w: %q (allowed: %v)", ErrInvalidStatus, issue.Meta.Status, cfg.Statuses)
	}

	if !slices.Contains(cfg.Priorities, issue.Meta.Priority) {
		return fmt.Errorf("%w: %q (allowed: %v)", ErrInvalidPriority, issue.Meta.Priority, cfg.Priorities)
	}

	return nil
}

// IDNumber extracts the numeric part of an issue ID (e.g., "NOR-3" → 3).
func IDNumber(id string) (int, error) {
	parts := strings.SplitN(id, "-", 2)
	if len(parts) != 2 {
		return 0, fmt.Errorf("%w: %q", ErrInvalidID, id)
	}
	var n int
	if _, err := fmt.Sscanf(parts[1], "%d", &n); err != nil {
		return 0, fmt.Errorf("%w: %q", ErrInvalidID, id)
	}
	return n, nil
}

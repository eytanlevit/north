package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testIssueAllFields = `---
format_version: 1
id: NOR-1
title: Implement user authentication
status: in-progress
priority: high
labels: [auth, backend]
parent: NOR-0
blocked_by: [NOR-2]
docs: [docs/prd.md]
created: 2026-02-28
updated: 2026-02-28
comments:
    - author: claude-code
      date: 2026-02-28
      body: |
        Started work on this.
---

## Description

Implement JWT-based authentication...
`

const testIssueMinimal = `---
format_version: 1
id: NOR-2
title: Simple task
status: todo
priority: medium
created: 2026-02-28
updated: 2026-02-28
---
`

func testConfig() *Config {
	cfg := DefaultConfig("test")
	return &cfg
}

func TestParseIssue_AllFields(t *testing.T) {
	issue, err := ParseIssue([]byte(testIssueAllFields))
	require.NoError(t, err)

	assert.Equal(t, 1, issue.Meta.FormatVersion)
	assert.Equal(t, "NOR-1", issue.Meta.ID)
	assert.Equal(t, "Implement user authentication", issue.Meta.Title)
	assert.Equal(t, "in-progress", issue.Meta.Status)
	assert.Equal(t, "high", issue.Meta.Priority)
	assert.Equal(t, []string{"auth", "backend"}, issue.Meta.Labels)
	assert.Equal(t, "NOR-0", issue.Meta.Parent)
	assert.Equal(t, []string{"NOR-2"}, issue.Meta.BlockedBy)
	assert.Equal(t, []string{"docs/prd.md"}, issue.Meta.Docs)
	assert.Equal(t, "2026-02-28", issue.Meta.Created)
	assert.Equal(t, "2026-02-28", issue.Meta.Updated)
	require.Len(t, issue.Meta.Comments, 1)
	assert.Equal(t, "claude-code", issue.Meta.Comments[0].Author)
	assert.Equal(t, "Started work on this.\n", issue.Meta.Comments[0].Body)
	assert.Contains(t, issue.Body, "## Description")
	assert.Contains(t, issue.Body, "Implement JWT-based authentication...")
}

func TestParseIssue_MinimalFields(t *testing.T) {
	issue, err := ParseIssue([]byte(testIssueMinimal))
	require.NoError(t, err)

	assert.Equal(t, "NOR-2", issue.Meta.ID)
	assert.Equal(t, "Simple task", issue.Meta.Title)
	assert.Empty(t, issue.Meta.Labels)
	assert.Empty(t, issue.Meta.Parent)
	assert.Empty(t, issue.Meta.BlockedBy)
	assert.Empty(t, issue.Meta.Comments)
	assert.Empty(t, issue.Body)
}

func TestParseIssue_MissingDelimiters(t *testing.T) {
	_, err := ParseIssue([]byte("no frontmatter here"))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "missing opening frontmatter delimiter")

	_, err = ParseIssue([]byte("---\nid: NOR-1\nno closing delimiter"))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "missing closing frontmatter delimiter")
}

func TestParseIssue_InvalidYAML(t *testing.T) {
	_, err := ParseIssue([]byte("---\n: :\n  bad yaml\n  [\n---\n"))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid frontmatter YAML")
}

func TestSerializeIssue_Roundtrip(t *testing.T) {
	// Parse the minimal issue
	original, err := ParseIssue([]byte(testIssueMinimal))
	require.NoError(t, err)

	// Serialize
	data, err := SerializeIssue(original)
	require.NoError(t, err)

	// Parse again
	roundtripped, err := ParseIssue(data)
	require.NoError(t, err)

	assert.Equal(t, original.Meta, roundtripped.Meta)
	assert.Equal(t, original.Body, roundtripped.Body)
}

func TestSerializeIssue_RoundtripWithBody(t *testing.T) {
	original, err := ParseIssue([]byte(testIssueAllFields))
	require.NoError(t, err)

	data, err := SerializeIssue(original)
	require.NoError(t, err)

	roundtripped, err := ParseIssue(data)
	require.NoError(t, err)

	assert.Equal(t, original.Meta.ID, roundtripped.Meta.ID)
	assert.Equal(t, original.Meta.Title, roundtripped.Meta.Title)
	assert.Equal(t, original.Body, roundtripped.Body)
}

func TestSerializeIssue_SortsLabels(t *testing.T) {
	issue := &Issue{
		Meta: IssueMeta{
			FormatVersion: 1,
			ID:            "NOR-1",
			Title:         "Test",
			Status:        "todo",
			Priority:      "medium",
			Labels:        []string{"zebra", "alpha", "middle"},
			Created:       "2026-02-28",
			Updated:       "2026-02-28",
		},
	}

	data, err := SerializeIssue(issue)
	require.NoError(t, err)

	parsed, err := ParseIssue(data)
	require.NoError(t, err)
	assert.Equal(t, []string{"alpha", "middle", "zebra"}, parsed.Meta.Labels)

	// Original should not be modified
	assert.Equal(t, []string{"zebra", "alpha", "middle"}, issue.Meta.Labels)
}

func TestSerializeIssue_RoundtripSpecialChars(t *testing.T) {
	tests := []struct {
		name  string
		title string
	}{
		{"colon in title", "Fix: authentication bug"},
		{"multiple colons", "API: Auth: Fix token refresh"},
		{"hash in title", "Fix #123"},
		{"brackets", "Add [WIP] feature"},
		{"curly braces", "Config {json} support"},
		{"leading space colon", " : edge case"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issue := &Issue{
				Meta: IssueMeta{
					FormatVersion: 1,
					ID:            "NOR-1",
					Title:         tt.title,
					Status:        "todo",
					Priority:      "medium",
					Created:       "2026-02-28",
					Updated:       "2026-02-28",
				},
			}
			data, err := SerializeIssue(issue)
			require.NoError(t, err)

			parsed, err := ParseIssue(data)
			require.NoError(t, err, "failed to parse serialized issue with title %q, output:\n%s", tt.title, string(data))
			assert.Equal(t, tt.title, parsed.Meta.Title)
		})
	}
}

func TestValidateIssue_Valid(t *testing.T) {
	cfg := testConfig()
	issue := &Issue{
		Meta: IssueMeta{
			ID:       "NOR-1",
			Title:    "Valid issue",
			Status:   "todo",
			Priority: "medium",
		},
	}
	assert.NoError(t, ValidateIssue(issue, cfg))
}

func TestValidateIssue_InvalidStatus(t *testing.T) {
	cfg := testConfig()
	issue := &Issue{
		Meta: IssueMeta{
			ID:       "NOR-1",
			Title:    "Test",
			Status:   "invalid-status",
			Priority: "medium",
		},
	}
	err := ValidateIssue(issue, cfg)
	assert.ErrorIs(t, err, ErrInvalidStatus)
}

func TestValidateIssue_InvalidPriority(t *testing.T) {
	cfg := testConfig()
	issue := &Issue{
		Meta: IssueMeta{
			ID:       "NOR-1",
			Title:    "Test",
			Status:   "todo",
			Priority: "invalid-priority",
		},
	}
	err := ValidateIssue(issue, cfg)
	assert.ErrorIs(t, err, ErrInvalidPriority)
}

func TestValidateIssue_EmptyTitle(t *testing.T) {
	cfg := testConfig()
	issue := &Issue{
		Meta: IssueMeta{
			ID:       "NOR-1",
			Title:    "",
			Status:   "todo",
			Priority: "medium",
		},
	}
	err := ValidateIssue(issue, cfg)
	assert.Error(t, err)
}

func TestValidateIssue_InvalidID(t *testing.T) {
	cfg := testConfig()
	tests := []struct {
		name string
		id   string
	}{
		{"lowercase", "nor-1"},
		{"no number", "NOR-"},
		{"no dash", "NOR1"},
		{"empty", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issue := &Issue{
				Meta: IssueMeta{
					ID:       tt.id,
					Title:    "Test",
					Status:   "todo",
					Priority: "medium",
				},
			}
			err := ValidateIssue(issue, cfg)
			assert.Error(t, err)
		})
	}
}

func TestIDNumber(t *testing.T) {
	n, err := IDNumber("NOR-3")
	require.NoError(t, err)
	assert.Equal(t, 3, n)

	n, err = IDNumber("NOR-42")
	require.NoError(t, err)
	assert.Equal(t, 42, n)

	_, err = IDNumber("invalid")
	assert.Error(t, err)
}

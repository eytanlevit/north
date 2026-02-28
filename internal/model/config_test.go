package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig("my-project")

	assert.Equal(t, "my-project", cfg.Project)
	assert.Equal(t, "NOR", cfg.Prefix)
	assert.Equal(t, []string{"todo", "in-progress", "done"}, cfg.Statuses)
	assert.Equal(t, []string{"low", "medium", "high", "critical"}, cfg.Priorities)
}

func TestConfigParseSerializeRoundtrip(t *testing.T) {
	original := DefaultConfig("test-project")

	data, err := SerializeConfig(&original)
	require.NoError(t, err)

	parsed, err := ParseConfig(data)
	require.NoError(t, err)

	assert.Equal(t, original, *parsed)
}

func TestParseConfig_Invalid(t *testing.T) {
	_, err := ParseConfig([]byte(":::invalid yaml[[["))
	assert.Error(t, err)
}

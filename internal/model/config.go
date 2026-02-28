package model

import (
	"fmt"

	"gopkg.in/yaml.v3"
)

// Config represents the .north/config.yaml file.
type Config struct {
	Project    string   `yaml:"project" json:"project"`
	Prefix     string   `yaml:"prefix" json:"prefix"`
	Statuses   []string `yaml:"statuses" json:"statuses"`
	Priorities []string `yaml:"priorities" json:"priorities"`
}

// DefaultConfig returns a config with sensible defaults.
func DefaultConfig(projectName string) Config {
	return Config{
		Project:    projectName,
		Prefix:     "NOR",
		Statuses:   []string{"todo", "in-progress", "done"},
		Priorities: []string{"low", "medium", "high", "critical"},
	}
}

// ParseConfig parses a config from YAML bytes.
func ParseConfig(data []byte) (*Config, error) {
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("invalid config YAML: %w", err)
	}
	return &cfg, nil
}

// SerializeConfig serializes a config to YAML bytes.
func SerializeConfig(cfg *Config) ([]byte, error) {
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}
	return data, nil
}

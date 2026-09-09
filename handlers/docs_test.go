package handlers

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScanDocDir_SymlinksAndCycleDetection(t *testing.T) {
	// Create temporary root directory
	rootDir, err := os.MkdirTemp("", "doc_scan_root_*")
	if err != nil {
		t.Fatalf("failed to create temp rootDir: %v", err)
	}
	defer os.RemoveAll(rootDir)

	// Create temporary external directory (outside rootDir)
	externalDir, err := os.MkdirTemp("", "doc_scan_external_*")
	if err != nil {
		t.Fatalf("failed to create temp externalDir: %v", err)
	}
	defer os.RemoveAll(externalDir)

	// 1. In rootDir: normal doc
	if err := os.WriteFile(filepath.Join(rootDir, "intro.md"), []byte("# Intro"), 0644); err != nil {
		t.Fatalf("failed to write intro.md: %v", err)
	}

	// 2. In rootDir: empty folder (should NOT be included)
	emptyDir := filepath.Join(rootDir, "empty_folder")
	if err := os.Mkdir(emptyDir, 0755); err != nil {
		t.Fatalf("failed to create empty_folder: %v", err)
	}

	// 3. In rootDir: folder with only non-markdown files (should NOT be included)
	assetsDir := filepath.Join(rootDir, "assets")
	if err := os.Mkdir(assetsDir, 0755); err != nil {
		t.Fatalf("failed to create assetsDir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(assetsDir, "image.png"), []byte("PNGDATA"), 0644); err != nil {
		t.Fatalf("failed to write image.png: %v", err)
	}

	// 4. In externalDir: prepare some markdown docs and subfolders
	if err := os.WriteFile(filepath.Join(externalDir, "external_readme.md"), []byte("# External Readme"), 0644); err != nil {
		t.Fatalf("failed to write external_readme.md: %v", err)
	}
	extSubDir := filepath.Join(externalDir, "advanced")
	if err := os.Mkdir(extSubDir, 0755); err != nil {
		t.Fatalf("failed to create extSubDir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(extSubDir, "guide.markdown"), []byte("# Advanced Guide"), 0644); err != nil {
		t.Fatalf("failed to write guide.markdown: %v", err)
	}

	// Create symlink in rootDir pointing to externalDir
	symlinkDirPath := filepath.Join(rootDir, "mounted_docs")
	if err := os.Symlink(externalDir, symlinkDirPath); err != nil {
		t.Fatalf("failed to create symlink for directory: %v", err)
	}

	// 5. Create symlink to an external single file
	externalSingleFile := filepath.Join(externalDir, "single_external.md")
	if err := os.WriteFile(externalSingleFile, []byte("# Single External"), 0644); err != nil {
		t.Fatalf("failed to write externalSingleFile: %v", err)
	}
	symlinkFilePath := filepath.Join(rootDir, "linked_single.md")
	if err := os.Symlink(externalSingleFile, symlinkFilePath); err != nil {
		t.Fatalf("failed to create symlink for file: %v", err)
	}

	// 6. Create a broken symlink (should be skipped)
	brokenSymlink := filepath.Join(rootDir, "broken.md")
	_ = os.Symlink(filepath.Join(externalDir, "non_existent_file.md"), brokenSymlink)

	// 7. Create circular symlink (should not cause infinite loop)
	loopSymlink := filepath.Join(externalDir, "loop_back_to_root")
	_ = os.Symlink(rootDir, loopSymlink)

	// Run scan
	nodes, err := scanDocDir(rootDir, rootDir)
	if err != nil {
		t.Fatalf("scanDocDir failed: %v", err)
	}

	// Validate results
	nodeMap := make(map[string]DocNode)
	for _, n := range nodes {
		nodeMap[n.Name] = n
	}

	// 1. Check intro.md
	if introNode, ok := nodeMap["intro.md"]; !ok || introNode.IsDir || introNode.Path != "intro.md" {
		t.Errorf("expected intro.md node, got %+v", introNode)
	}

	// 2. Check empty_folder is omitted
	if _, ok := nodeMap["empty_folder"]; ok {
		t.Errorf("empty_folder should not be present in nodes")
	}

	// 3. Check assets folder (non-md) is omitted
	if _, ok := nodeMap["assets"]; ok {
		t.Errorf("assets folder with no md files should not be present in nodes")
	}

	// 4. Check mounted_docs (external symlinked directory) is present
	mountedNode, ok := nodeMap["mounted_docs"]
	if !ok {
		t.Fatalf("mounted_docs symlink directory was not found in nodes")
	}
	if !mountedNode.IsDir {
		t.Errorf("mounted_docs should have IsDir = true")
	}
	if mountedNode.Path != "mounted_docs" {
		t.Errorf("expected mounted_docs path 'mounted_docs', got '%s'", mountedNode.Path)
	}

	// Check children of mounted_docs
	mountedChildMap := make(map[string]DocNode)
	for _, c := range mountedNode.Children {
		mountedChildMap[c.Name] = c
	}

	if extReadme, ok := mountedChildMap["external_readme.md"]; !ok || extReadme.Path != "mounted_docs/external_readme.md" {
		t.Errorf("expected external_readme.md child under mounted_docs, got %+v", extReadme)
	}

	if advDir, ok := mountedChildMap["advanced"]; !ok || !advDir.IsDir || advDir.Path != "mounted_docs/advanced" {
		t.Errorf("expected advanced child dir under mounted_docs, got %+v", advDir)
	} else {
		if len(advDir.Children) != 1 || advDir.Children[0].Name != "guide.markdown" {
			t.Errorf("expected guide.markdown inside advanced, got %+v", advDir.Children)
		}
	}

	// 5. Check linked_single.md
	if singleNode, ok := nodeMap["linked_single.md"]; !ok || singleNode.IsDir || singleNode.Path != "linked_single.md" {
		t.Errorf("expected linked_single.md node, got %+v", singleNode)
	}

	// 6. Check broken symlink is omitted
	if _, ok := nodeMap["broken.md"]; ok {
		t.Errorf("broken.md should not be included in nodes")
	}
}

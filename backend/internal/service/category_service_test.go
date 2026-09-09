package service

import (
	"strings"
	"testing"

	"knowledge-base/backend/internal/model"
	"knowledge-base/backend/internal/repository"
)

func newEmptyCategoryService(t *testing.T) (*CategoryService, *repository.CategoryRepository, *repository.DB) {
	t.Helper()
	db := newTestDB(t)
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.Exec("DELETE FROM documents; DELETE FROM categories"); err != nil {
		t.Fatalf("clear seeded categories: %v", err)
	}
	categories := repository.NewCategoryRepository(db)
	return NewCategoryService(categories, repository.NewDocumentRepository(db)), categories, db
}

func createCategoryForTest(t *testing.T, service *CategoryService, name, slug string, parentID int64) *model.Category {
	t.Helper()
	category, err := service.Create(model.CategorySaveReq{Name: name, Slug: slug, ParentID: parentID, SortOrder: 1})
	if err != nil {
		t.Fatalf("Create(%q): %v", name, err)
	}
	return category
}

func flattenCategoriesForTest(nodes []*model.Category) []*model.Category {
	result := make([]*model.Category, 0)
	var visit func([]*model.Category)
	visit = func(items []*model.Category) {
		for _, item := range items {
			result = append(result, item)
			visit(item.Children)
		}
	}
	visit(nodes)
	return result
}

func TestCategoryCreatePreservesExistingTreeAndDocumentAssociation(t *testing.T) {
	service, repo, db := newEmptyCategoryService(t)

	development := createCategoryForTest(t, service, "开发", "development", 0)
	createCategoryForTest(t, service, "React", "react", development.ID)
	createCategoryForTest(t, service, "Go", "go", development.ID)
	operations := createCategoryForTest(t, service, "运维", "operations", 0)
	createCategoryForTest(t, service, "Docker", "docker", operations.ID)

	result, err := db.Exec(`
		INSERT INTO documents (title, slug, content, status, category_id, author_id)
		VALUES ('现有文章', 'existing-document', 'body', 'published', ?, 1)
	`, development.ID)
	if err != nil {
		t.Fatalf("insert existing document: %v", err)
	}
	documentID, _ := result.LastInsertId()

	before, err := repo.Count()
	if err != nil || before != 5 {
		t.Fatalf("before count = %d, err=%v, want 5", before, err)
	}
	python := createCategoryForTest(t, service, "Python", "python", 0)
	if python.ParentID != 0 {
		t.Fatalf("Python parent_id = %d, want root", python.ParentID)
	}

	after, err := repo.Count()
	if err != nil || after != before+1 {
		t.Fatalf("after count = %d, err=%v, want %d", after, err, before+1)
	}
	for request := 1; request <= 2; request++ {
		tree, err := service.GetTree()
		if err != nil {
			t.Fatalf("GetTree request %d: %v", request, err)
		}
		if got := len(flattenCategoriesForTest(tree)); got != 6 {
			t.Fatalf("GetTree request %d returned %d categories, want 6", request, got)
		}
	}

	var categoryID int64
	if err := db.QueryRow("SELECT category_id FROM documents WHERE id = ?", documentID).Scan(&categoryID); err != nil {
		t.Fatalf("read existing document: %v", err)
	}
	if categoryID != development.ID {
		t.Fatalf("document category_id = %d, want %d", categoryID, development.ID)
	}
}

func TestCategoryCreateChildPreservesOtherCategories(t *testing.T) {
	service, repo, _ := newEmptyCategoryService(t)
	development := createCategoryForTest(t, service, "开发", "development", 0)
	operations := createCategoryForTest(t, service, "运维", "operations", 0)
	createCategoryForTest(t, service, "Docker", "docker", operations.ID)

	vue := createCategoryForTest(t, service, "Vue", "vue", development.ID)
	if vue.ParentID != development.ID {
		t.Fatalf("Vue parent_id = %d, want %d", vue.ParentID, development.ID)
	}
	all, err := repo.ListAll()
	if err != nil || len(all) != 4 {
		t.Fatalf("ListAll = %d categories, err=%v, want 4", len(all), err)
	}
	tree, err := service.GetTree()
	if err != nil {
		t.Fatal(err)
	}
	if len(tree) != 2 || len(tree[0].Children) != 1 || len(tree[1].Children) != 1 {
		t.Fatalf("unexpected tree after child creation: %#v", tree)
	}
}

func TestCategorySlugConflictFailsWithoutReplacingExistingCategory(t *testing.T) {
	service, repo, _ := newEmptyCategoryService(t)
	original := createCategoryForTest(t, service, "原分类", "shared-slug", 0)

	if _, err := service.Create(model.CategorySaveReq{Name: "冲突分类", Slug: "shared-slug"}); err == nil || err.Error() != "分类 Slug 已存在" {
		t.Fatalf("duplicate slug error = %v, want 分类 Slug 已存在", err)
	}
	all, err := repo.ListAll()
	if err != nil || len(all) != 1 || all[0].ID != original.ID || all[0].Name != original.Name {
		t.Fatalf("duplicate create changed categories: %#v, err=%v", all, err)
	}
}

func TestCategoryBlankSlugGeneratesUniqueValues(t *testing.T) {
	service, _, _ := newEmptyCategoryService(t)
	first := createCategoryForTest(t, service, "Python Guide", "", 0)
	second := createCategoryForTest(t, service, "Python Guide", "", 0)

	if first.Slug != "python-guide" {
		t.Fatalf("first generated slug = %q, want python-guide", first.Slug)
	}
	if second.Slug == first.Slug || !strings.HasPrefix(second.Slug, "python-guide-") {
		t.Fatalf("second generated slug = %q, want unique python-guide-*", second.Slug)
	}
}

func TestCategoryHierarchyRejectsCyclesAndInvalidParents(t *testing.T) {
	service, repo, _ := newEmptyCategoryService(t)
	root := createCategoryForTest(t, service, "根分类", "root", 0)
	child := createCategoryForTest(t, service, "子分类", "child", root.ID)

	if _, err := service.Update(root.ID, model.CategorySaveReq{Name: root.Name, Slug: root.Slug, ParentID: child.ID}); err == nil || !strings.Contains(err.Error(), "自己的子分类") {
		t.Fatalf("descendant parent error = %v", err)
	}
	if _, err := service.Update(root.ID, model.CategorySaveReq{Name: root.Name, Slug: root.Slug, ParentID: root.ID}); err == nil || !strings.Contains(err.Error(), "自己设为父级") {
		t.Fatalf("self parent error = %v", err)
	}
	if _, err := service.Create(model.CategorySaveReq{Name: "孤儿", Slug: "orphan", ParentID: 99999}); err == nil || !strings.Contains(err.Error(), "父级分类不存在") {
		t.Fatalf("missing parent error = %v", err)
	}
	storedRoot, err := repo.GetByID(root.ID)
	if err != nil || storedRoot.ParentID != 0 {
		t.Fatalf("root changed after rejected updates: %#v, err=%v", storedRoot, err)
	}
}

func TestCategoryTreeKeepsLegacyCyclicRowsVisible(t *testing.T) {
	service, repo, db := newEmptyCategoryService(t)
	root := createCategoryForTest(t, service, "旧根分类", "legacy-root", 0)
	child := createCategoryForTest(t, service, "旧子分类", "legacy-child", root.ID)
	if _, err := db.Exec("UPDATE categories SET parent_id = ? WHERE id = ?", child.ID, root.ID); err != nil {
		t.Fatalf("prepare legacy cycle: %v", err)
	}

	tree, err := service.GetTree()
	if err != nil {
		t.Fatal(err)
	}
	flat := flattenCategoriesForTest(tree)
	if len(flat) != 2 || len(tree) != 1 || tree[0].ID != root.ID || tree[0].ParentID != 0 {
		t.Fatalf("legacy cycle was hidden instead of normalized: %#v", tree)
	}
	if count, err := repo.Count(); err != nil || count != 2 {
		t.Fatalf("tree normalization mutated persisted rows: count=%d err=%v", count, err)
	}
}

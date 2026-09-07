package repository

import "testing"

func TestUserRepositoryListUsersFiltersAndPagination(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	repo := NewUserRepository(db)
	for _, row := range []struct{ n, r, s string }{{"alice", "member", "active"}, {"alice2", "member", "active"}, {"bob", "member", "disabled"}, {"root2", "admin", "active"}} {
		if _, err := db.Exec("INSERT INTO users (username,password_hash,nickname,role,status) VALUES (?,?,?, ?,?)", row.n, "hash", row.n, row.r, row.s); err != nil {
			t.Fatal(err)
		}
	}
	all, total, err := repo.ListUsers(UserListFilter{Page: 1, PageSize: 20})
	if err != nil || total != 5 || len(all) != 5 {
		t.Fatalf("all=%d total=%d err=%v", len(all), total, err)
	}
	for i := 1; i < len(all); i++ {
		if all[i-1].ID <= all[i].ID {
			t.Fatal("not id desc")
		}
	}
	items, total, err := repo.ListUsers(UserListFilter{Query: "ali", Role: "member", Status: "active", Page: 1, PageSize: 20})
	if err != nil || total != 2 || len(items) != 2 {
		t.Fatalf("combined %#v %d %v", items, total, err)
	}
	disabled, total, err := repo.ListUsers(UserListFilter{Status: "disabled", Page: 1, PageSize: 20})
	if err != nil || total != 1 || disabled[0].Username != "bob" {
		t.Fatal("status filter")
	}
	p1, total, _ := repo.ListUsers(UserListFilter{Page: 1, PageSize: 2})
	p2, _, _ := repo.ListUsers(UserListFilter{Page: 2, PageSize: 2})
	if total != 5 || p1[0].ID == p2[0].ID {
		t.Fatal("pagination")
	}
}
func TestUserRepositoryRoleMutation(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	r := NewUserRepository(db)
	id, err := r.CreateManagedUser("member", "h", "member")
	if err != nil {
		t.Fatal(err)
	}
	if err = r.UpdateManagedUserRole(id, "admin"); err != nil {
		t.Fatal(err)
	}
	u, _ := r.GetByID(id)
	if u.Role != "admin" || u.AuthVersion != 2 {
		t.Fatal(u)
	}
	if err = r.UpdateManagedUserRole(id, "admin"); err != nil {
		t.Fatal(err)
	}
	u, _ = r.GetByID(id)
	if u.AuthVersion != 2 {
		t.Fatal(u.AuthVersion)
	}
	if err = r.UpdateManagedUserRole(999, "member"); err != ErrUserNotFound {
		t.Fatal(err)
	}
}
func TestUserRepositoryResetPassword(t *testing.T) {
	db := newTestDB(t)
	defer db.Close()
	r := NewUserRepository(db)
	id, _ := r.CreateManagedUser("reset", "old", "member")
	before, _ := r.GetByID(id)
	if err := r.ResetManagedUserPassword(id, "new"); err != nil {
		t.Fatal(err)
	}
	after, _ := r.GetByID(id)
	if after.PasswordHash != "new" || after.AuthVersion != before.AuthVersion+1 || after.Role != before.Role || after.Status != before.Status {
		t.Fatal(after)
	}
	if err := r.ResetManagedUserPassword(999, "x"); err != ErrUserNotFound {
		t.Fatal(err)
	}
}

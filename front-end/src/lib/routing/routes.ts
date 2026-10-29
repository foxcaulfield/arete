import { router } from "./router.svelte";
import HomePage from "$lib/components/pages/HomePage.svelte";
import ProfilePage from "$lib/components/pages/ProfilePage.svelte";
import AuthPage from "$lib/components/pages/AuthPage.svelte";
import CollectionsPage from "$lib/components/pages/CollectionsPage.svelte";
import CollectionAllPage from "$lib/components/pages/CollectionAllPage.svelte";
import CollectionCreatePage from "$lib/components/pages/CollectionCreatePage.svelte";
import CollectionEditPage from "$lib/components/pages/CollectionEditPage.svelte";
import CollectionViewPage from "$lib/components/pages/CollectionViewPage.svelte";
import ExerciseCreatePage from "$lib/components/pages/ExerciseCreatePage.svelte";
import ExerciseEditPage from "$lib/components/pages/ExerciseEditPage.svelte";
import QuizPage from "$lib/components/pages/QuizPage.svelte";
import ErrorPage from "$lib/components/pages/ErrorPage.svelte";
import AdminUsersPage from "$lib/components/pages/AdminUsersPage.svelte";
import SharedCollectionsPage from "$lib/components/pages/SharedCollectionsPage.svelte";
import GlobalPracticePage from "$lib/components/pages/GlobalPracticePage.svelte";

export function registerRoutes(): void {
	router.register("/", HomePage);
	router.register("/profile", ProfilePage);
	router.register("/auth", AuthPage);

	router.register("/collections", CollectionsPage);
	router.register("/collections/shared", SharedCollectionsPage);
	router.register("/collections/all", CollectionAllPage);
	router.register("/collections/create", CollectionCreatePage);
	router.register("/collections/view/:slug", CollectionViewPage);
	router.register("/collections/edit/:slug", CollectionEditPage);

	router.register("/collections/view/:slug/exercises/create", ExerciseCreatePage);
	router.register("/collections/view/:slug/exercises/edit/:id", ExerciseEditPage);
	router.register("/collections/view/:slug/exercises/quiz", QuizPage);

	router.register("/practice", GlobalPracticePage);
	
	router.register("/admin/users", AdminUsersPage);
	router.registerNotFound(ErrorPage);
}

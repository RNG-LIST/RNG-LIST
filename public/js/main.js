import routes from './routes.js';

export const store = Vue.reactive({
    dark: JSON.parse(localStorage.getItem('dark')) || false,

    toggleDark() {
        this.dark = !this.dark;
        localStorage.setItem('dark', JSON.stringify(this.dark));
    }
});

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
});

router.beforeEach((to, from, next) => {
    let title = "RNG LIST | The RNG List";

    if (to.path === '/') title = "RNG LIST | The RNG List";
    else if (to.path === '/leaderboard') title = "Leaderboard | RNGLIST";
    else if (to.path === '/roulette') title = "Roulette | RNGLIST";
    else if (to.path === '/admin') title = "Admin Panel | RNGLIST";
    else if (to.path === '/manage') title = "Management Panel | RNGLIST";
    else if (to.path === '/packs') title = "Packs | RNGLIST";

    document.title = title;
    next();
});

const app = Vue.createApp({
    data: () => ({ store })
});

app.use(router);
app.mount('#app');

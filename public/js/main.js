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
    let title = "TPL | The Piss List";

    if (to.path === '/') title = "TPL | The Piss List";
    else if (to.path === '/leaderboard') title = "Leaderboard | TPL";
    else if (to.path === '/roulette') title = "Roulette | TPL";
    else if (to.path === '/admin') title = "Admin Panel | TPL";
    else if (to.path === '/manage') title = "Management Panel | TPL";
    else if (to.path === '/packs') title = "Packs | TPL";

    document.title = title;
    next();
});

const app = Vue.createApp({
    data: () => ({ store })
});

app.use(router);
app.mount('#app');
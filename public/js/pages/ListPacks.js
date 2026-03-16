import { store } from "../main.js";
import { fetchList } from "../content.js";
import { embed } from "../util.js";
import { score } from "../score.js";
import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

export default {
    components: { Spinner, LevelAuthors },
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        
        <main v-else class="page-list-packs">
            <div class="packs-nav">
                <div class="packs-scroll">
                    <button 
                        v-for="(pack, index) in packs" 
                        :key="pack.id"
                        @click="selectPack(index)"
                        :class="['pack-tab', 'type-label-lg', { active: selectedPackIndex === index }]"
                        :style="{ 
                            '--pack-color': pack.color || 'var(--color-primary)'
                        }"
                    >
                        {{ pack.name }}
                    </button>
                </div>
            </div>

            <div class="pack-content-grid">
                
                <div class="list-container">
                    <div class="pack-meta-header" v-if="selectedPack">
                        <h2 class="type-headline-md" :style="{ color: selectedPack.color }">{{ selectedPack.name }}</h2>
                        <p class="pack-reward type-body">
                            Reward: <strong>{{ selectedPackScore }}</strong> Points
                        </p>
                    </div>

                    <table class="list" v-if="selectedPack">
                        <tr v-for="(levelId, i) in selectedPack.levels" :key="levelId">
                            <td class="rank">
                                <span class="type-label-lg" 
                                      :class="{ 'goldhighlight': getLevelInfo(levelId).rank <= 150 }"
                                      :style="getLevelInfo(levelId).rank > 150 ? 'color: var(--color-text-legacy)' : ''">
                                    #{{ getLevelInfo(levelId).rank }}
                                </span>
                            </td>
                            <td class="level" :class="{ 'active': selectedLevelIndex === i }">
                                <button @click="selectedLevelIndex = i">
                                    <span class="type-label-lg">
                                        {{ getLevelInfo(levelId).name }}
                                    </span>
                                </button>
                            </td>
                        </tr>
                    </table>
                    <div v-else class="empty-state" style="padding: 2rem; text-align: center; color: #888;">
                        <p class="type-body">No pack selected</p>
                    </div>
                </div>

                <div class="level-container">
                    <div class="level" v-if="selectedLevel">
                        <h1 class="type-h1">{{ selectedLevel.name }}</h1>
                        
                        <div class="level-credits">
                            <span class="label type-label-md">Creator & Verifier</span>
                            <span class="value type-label-lg">{{ selectedLevel.author }}</span>

                            <template v-if="selectedLevel.creators && selectedLevel.creators.length">
                                <span class="label type-label-md">Creators</span>
                                <span class="value type-label-lg">{{ selectedLevel.creators.join(', ') }}</span>
                            </template>

                            <span class="label type-label-md">Publisher</span>
                            <span class="value type-label-lg">{{ selectedLevel.verifier || selectedLevel.author }}</span>
                        </div>
                        
                        <p class="warning-lable type-label-md" v-if="selectedLevel.epilepsyWarning">
                            WARNING! Levels AND videos may be epileptic
                        </p>
                        
                        <div v-html="embed(selectedLevel.showcase || selectedLevel.verification)"></div>
                        
                        <ul class="stats">
                            <li>
                                <div class="type-title-sm">Points when completed</div>
                                <p class="type-body" :style="getLevelInfo(selectedLevel.id).rank > 150 ? 'color: var(--color-text-minus)' : ''">
                                    {{ getLevelScore(selectedLevel.id) }}
                                </p>
                            </li>
                            <li>
                                <div class="type-title-sm">ID</div>
                                <p class="type-body">{{ selectedLevel.id }}</p>
                            </li>
                            <li>
                                <div class="type-title-sm">Password</div>
                                <p class="type-body">{{ selectedLevel.password || 'Free to Copy' }}</p>
                            </li>
                        </ul>

                        <h2 class="type-headline-md">Records</h2>
                        
                        <p class="level-qualify-text type-body">
                            <strong>{{ selectedLevel.percentToQualify }}%</strong> or better to qualify
                        </p>
                        
                        <table class="records">
                            <tr v-for="record in selectedLevel.records" :key="record.user" class="record">
                                <td class="percent">
                                    <p class="type-label-lg">{{ record.percent }}%</p>
                                </td>
                                <td class="user">
                                    <a class="type-label-lg" :href="record.link" target="_blank">{{ record.user }}</a>
                                </td>
                                <td class="mobile">
                                    <img v-if="record.mobile" :src="\`/assets/phone-landscape\${store.dark ? '-dark' : ''}.svg\`" alt="Mobile" style="height: 18px;">
                                </td>
                                <td class="hz">
                                    <p class="type-label-lg">{{ record.hz }}Hz</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                    <div v-else class="level" style="height: 100%; display: flex; justify-content: center; align-items: center; color: #888; flex-direction: column;">
                        <p class="type-body">Select a level to view details.</p>
                    </div>
                </div>
            </div>
        </main>
    `,
    data: () => ({
        packs: [],
        levelList: [],
        selectedPackIndex: 0,
        selectedLevelIndex: 0,
        loading: true,
        store,
    }),

    computed: {
        selectedPack() { 
            return this.packs[this.selectedPackIndex] || null; 
        },
        selectedLevelGDId() { 
            return this.selectedPack?.levels[this.selectedLevelIndex] || null; 
        },
        selectedLevel() {
            const info = this.getLevelInfo(this.selectedLevelGDId);
            return info.level;
        },
        selectedPackScore() {
            if (!this.selectedPack) return 0;
            let totalPoints = 0;
            this.selectedPack.levels.forEach(gdId => {
                totalPoints += this.getLevelScore(gdId);
            });
            return (totalPoints * 0.33).toFixed(2);
        }
    },
    async mounted() {
        await this.loadData();
        this.handleHashChange();
        window.addEventListener('hashchange', this.handleHashChange);
    },
    beforeUnmount() {
        window.removeEventListener('hashchange', this.handleHashChange);
    },
    methods: {
        embed,
        score,
        async loadData() {
            this.loading = true;
            try {
                const [levelsData, packsData] = await Promise.all([
                    fetchList(),
                    fetch("/api/packs").then((res) => res.json())
                ]);

                this.levelList = levelsData || [];
                this.packs = packsData || [];
            } catch (e) {
                console.error("Failed to load pack data", e);
            }
            this.loading = false;
        },
        selectPack(index) {
            this.selectedPackIndex = index;
            this.selectedLevelIndex = 0;
        },
        getLevelInfo(gdId) {
            if (!gdId) return { name: '', rank: 999, level: null };

            const index = this.levelList.findIndex(([lvl]) => String(lvl?.id) === String(gdId));
            if (index !== -1) {
                return { 
                    name: this.levelList[index][0].name, 
                    rank: index + 1, 
                    level: this.levelList[index][0]
                };
            }

            return { name: `Unknown Level (${gdId})`, rank: 999, level: null };
        },
        getLevelScore(gdId) {
            const info = this.getLevelInfo(gdId);
            if (!info.level) return 0;
            return score(info.rank, 100, info.level.percentToQualify);
        },
        handleHashChange() {
            try {
                const hash = window.location.hash || '';
                const qIndex = hash.indexOf('?');
                if (qIndex !== -1) {
                    const params = new URLSearchParams(hash.slice(qIndex + 1));
                    const packId = params.get('pack');
                    if (packId) {
                        const idx = this.packs.findIndex((p) => p.id === packId);
                        if (idx !== -1) {
                            this.selectedPackIndex = idx;
                            this.selectedLevelIndex = 0;
                        }
                    }
                }
            } catch (e) { }
        }
    },
};
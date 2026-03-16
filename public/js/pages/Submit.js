import { store } from '../main.js';
import { fetchList } from '../content.js';
import Spinner from '../components/Spinner.js';

export default {
    components: { Spinner },
    data() {
        return {
            store,
            submissionType: 'record',
            formData: {
                levelName: '',
                username: '',
                percent: '',
                hz: '240',
                discord: '',
                videoLink: '',
                notes: ''
            },
            levelFormData: {
                name: '',
                id: '',
                author: '',
                verifier: '',
                verification: '',
                percentToQualify: 100,
                placementSuggestion: '',
                notes: ''
            },
            turnstileToken: null,
            turnstileWidgetId: null, 
            turnstileError: '',
            isSubmitting: false,
            successMessage: '',
            errorMessage: '',
            submissions: [],
            loading: false,
            isProcessing: false,
            userRole: null,
            editingSubmission: null,
            denyingSubmission: null,
            denyReason: '',
            viewMode: false,
            levels: [],
            levelSearchInput: '',
            minPercent: 0
        };
    },
    computed: {
        filteredLevels() {
            const search = this.levelSearchInput.toLowerCase();
            if (!search) return this.levels.slice(0, 50);
            return this.levels.filter(level =>
                level[0] && level[0].name && level[0].name.toLowerCase().includes(search)
            );
        }
    },
    watch: {
        submissionType() {
            if (window.turnstile && this.turnstileWidgetId !== null) {
                try {
                    window.turnstile.remove(this.turnstileWidgetId);
                } catch (e) {}
            }
            this.turnstileError = '';
            this.renderTurnstile();
        }
    },
    template: `
        <main class="page-submit">
            <div class="submit-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div>
                        <h1 class="type-headline-lg">Submit to the List</h1>
                        <p class="type-body submit-intro" style="margin-top: 15px;">
                            Choose what you'd like to submit: a record on an existing level or a brand new level to be added to the list.
                        </p>
                    </div>
                    <div class="submit-type-toggle" style="display: flex; gap: 1rem; flex-shrink: 0;">
                        <button @click="submissionType = 'record'" 
                                :class="{ active: submissionType === 'record' }"
                                style="padding: 0.75rem 1.5rem; border: 2px solid var(--color-border); border-radius: 0.5rem; background: none; color: var(--color-text); cursor: pointer; font-size: 1rem; font-weight: 500; transition: all 0.2s; white-space: nowrap;"
                                :style="submissionType === 'record' ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: 'var(--color-background)' } : {}">
                            Submit Records
                        </button>
                        <button @click="submissionType = 'level'" 
                                :class="{ active: submissionType === 'level' }"
                                style="padding: 0.75rem 1.5rem; border: 2px solid var(--color-border); border-radius: 0.5rem; background: none; color: var(--color-text); cursor: pointer; font-size: 1rem; font-weight: 500; transition: all 0.2s; white-space: nowrap;"
                                :style="submissionType === 'level' ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: 'var(--color-background)' } : {}">
                            Submit Levels
                        </button>
                    </div>
                </div>

                <div class="submit-content">
                    <div class="submit-section" v-if="!viewMode && submissionType === 'record'">
                        <h2 class="type-headline-md">Submit a Record</h2>
                        <p class="type-body submit-intro" style="margin-top: 15px; opacity: 0.8;">
                            Complete the form below to submit your verified record. Staff will review and approve or deny your submission but PLEASE make sure to put your username exactly as it is with your other records or it'll treat it like another user!
                        </p>
                        <form @submit.prevent="submitRecord" class="submit-form">
                            <div class="level-selection-container">
                                <div class="level-search-column">
                                    <label class="type-label-lg">Level Name *</label>
                                    <input 
                                        v-model="levelSearchInput" 
                                        type="text" 
                                        class="level-search-input type-label-lg"
                                        placeholder="Search levels..." 
                                        aria-controls="level-listbox"
                                    />
                                    <div v-if="formData.levelName" class="level-selected type-label-md">
                                        ✓ Selected: {{ formData.levelName }}
                                    </div>
                                </div>

                                <div class="level-list-column">
                                    <label class="type-label-lg">Select from list:</label>
                                    <div class="level-list" id="level-listbox" role="listbox">
                                        <div v-if="filteredLevels.length === 0" class="no-results type-label-md">
                                            No levels found
                                        </div>
                                        <div 
                                            v-for="(level, index) in filteredLevels" 
                                            :key="'list-' + (level[0]?.id || level[0]?._id || '') + '-' + index"
                                            @click="selectLevel(level[0])"
                                            :class="{ active: formData.levelName === level[0]?.name }"
                                            class="level-item type-label-md"
                                            role="option"
                                        >
                                            <div class="level-item-name">{{ level[0]?.name }}</div>
                                            <div class="level-item-author">{{ level[0]?.author }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="type-label-lg">Your Username *</label>
                                    <input v-model="formData.username" type="text" class="type-label-lg" placeholder="Your list username" required />
                                </div>
                                <div class="form-group">
                                    <label class="type-label-lg">Percent Achieved *</label>
                                    <input v-model.number="formData.percent" type="number" class="type-label-lg" :min="minPercent" max="100" :placeholder="\`\${minPercent}-100\`" required />
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="type-label-lg">FPS / HZ *</label>
                                    <input v-model.number="formData.hz" type="number" class="type-label-lg" min="60" placeholder="60, 120, etc." required />
                                </div>
                                <div class="form-group">
                                <label class="type-label-lg">
                                Discord Username 
                                <span style="opacity: 0.5; display: inline-block;">(Optional)</span>
                                </label>
                                <input v-model="formData.discord" type="text" class="type-label-lg" placeholder="e.g. anticroom. or corno927.3" />
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="type-label-lg">Video Link *</label>
                                <input v-model="formData.videoLink" type="url" class="type-label-lg" placeholder="https://youtu.be/..." required />
                            </div>

                            <div class="form-group">
                                <label class="type-label-lg">Additional Notes</label>
                                <textarea v-model="formData.notes" class="type-label-lg" placeholder="Any other details about your submission..." rows="4"></textarea>
                            </div>

                            <div class="captcha-container">
                                <div id="turnstile-record"></div>
                                <div v-if="turnstileError" class="error-text" style="color: #ff4444; margin-top: 5px; font-weight: bold;">{{ turnstileError }}</div>
                            </div>

                            <button type="submit" class="btn-submit-record" :disabled="isSubmitting">
                                {{ isSubmitting ? 'Submitting...' : 'Submit Record' }}
                            </button>

                            <div v-if="successMessage" class="success-message">✓ {{ successMessage }}</div>
                            <div v-if="errorMessage" class="error-message">✗ {{ errorMessage }}</div>
                        </form>
                    </div>

                    <div class="submit-section" v-if="!viewMode && submissionType === 'level'">
                        <h2 class="type-headline-md">Submit a New Level</h2>
                        <p class="type-body submit-intro" style="margin-top: 15px; opacity: 0.8;">
                            Have a level you verified that you want placed? Submit them here and we'll accept them in time!
                        </p>
                        <form @submit.prevent="submitLevel" class="submit-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="type-label-lg">Level Name *</label>
                                    <input v-model="levelFormData.name" type="text" class="type-label-lg" placeholder="e.g. Bloodbath" required />
                                </div>
                                <div class="form-group">
                                    <label class="type-label-lg">Level ID *</label>
                                        <input 
                                        v-model.number="levelFormData.id"
                                        type="number"
                                        class="type-label-lg"
                                        placeholder="10000049475"
                                        required
                                        />
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="type-label-lg">Creator/Author *</label>
                                    <input v-model="levelFormData.author" type="text" class="type-label-lg" placeholder="Creator or Creator1, Creator2..." required />
                                </div>
                                <div class="form-group">
                                    <label class="type-label-lg">Verifier *</label>
                                    <input v-model="levelFormData.verifier" type="text" class="type-label-lg" placeholder="wPopo..." />
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="type-label-lg">Verification Video *</label>
                                <input v-model="levelFormData.verification" type="url" class="type-label-lg" placeholder="https://youtu.be/..." required />
                            </div>

                            <div class="form-group">
                                <label class="type-label-lg">Placement opinion *</label>
                                <input v-model="levelFormData.placementSuggestion" type="text" class="type-label-lg" placeholder="67 - 74" required />
                            </div>

                            <div class="form-group">
                                <label class="type-label-lg">Additional Notes</label>
                                <textarea v-model="levelFormData.notes" class="type-label-lg" placeholder="Any other details about this level..." rows="4"></textarea>
                            </div>

                            <div class="captcha-container">
                                <div id="turnstile-level"></div>
                                <div v-if="turnstileError" class="error-text" style="color: #ff4444; margin-top: 5px; font-weight: bold;">{{ turnstileError }}</div>
                            </div>

                            <button type="submit" class="btn-submit-record" :disabled="isSubmitting">
                                {{ isSubmitting ? 'Submitting...' : 'Submit Level' }}
                            </button>

                            <div v-if="successMessage" class="success-message">✓ {{ successMessage }}</div>
                            <div v-if="errorMessage" class="error-message">✗ {{ errorMessage }}</div>
                        </form>
                    </div>

                    <div class="submit-section" v-if="userRole && !viewMode" style="margin-top: 3rem; border-top: 2px solid var(--color-border); padding-top: 2rem;">
                        <h2 class="type-headline-md">Staff Review Panel</h2>
                        <p class="staff-info type-label-md">{{ userRole === 'admin' ? 'Admin' : 'Mod' }} - Review pending submissions</p>

                        <div v-if="loading" class="loading-spinner">
                            <Spinner></Spinner>
                        </div>

                        <div v-else-if="submissions.length === 0" class="no-submissions type-body">
                            <p>No pending submissions at the moment.</p>
                        </div>

                        <div v-else class="submissions-list">
                            <div v-for="submission in submissions" :key="submission.id" class="submission-card">
                                <div class="submission-header">
                                    <div>
                                        <h3 class="type-headline-sm">{{ submission.levelName || submission.name }}</h3>
                                        <p class="submission-meta type-label-sm">Submitted by {{ submission.username || submission.author }} • {{ formatDate(submission.created_at) }}</p>
                                    </div>
                                    <div class="submission-actions">
                                        <button @click="editSubmission(submission)" class="btn-edit type-label-sm">✎ Edit</button>
                                        <button @click="approveSubmission(submission.id)" class="btn-approve type-label-sm" :disabled="isProcessing">✓ Approve</button>
                                        <button @click="denySubmission(submission)" class="btn-deny type-label-sm" :disabled="isProcessing">✗ Deny</button>
                                    </div>
                                </div>

                                <div class="submission-details">
                                    <div class="detail-row">
                                        <span class="label type-label-md">Username:</span>
                                        <span class="value type-label-md">{{ submission.username }}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="label type-label-md">Percent:</span>
                                        <span class="value type-label-md">{{ submission.percent }}%</span>
                                    </div>
                                    <div class="detail-row" v-if="submission.hz">
                                        <span class="label type-label-md">FPS/Hz:</span>
                                        <span class="value type-label-md">{{ submission.hz }}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="label type-label-md">Discord:</span>
                                        <span class="value type-label-md">{{ submission.discord }}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="label type-label-md">Video:</span>
                                        <a :href="submission.video_link" target="_blank" class="video-link">{{ submission.video_link }}</a>
                                    </div>
                                    <div class="detail-row" v-if="submission.notes">
                                        <span class="label type-label-md">Notes:</span>
                                        <span class="value type-label-md">{{ submission.notes }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="editingSubmission" class="modal-overlay" @click.self="editingSubmission = null">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 class="type-headline-md">Edit Submission</h2>
                            <button class="btn-close" @click="editingSubmission = null">✕</button>
                        </div>
                        
                        <div class="modal-body">
                            <div class="form-group">
                                <label class="type-label-lg">Level Name</label>
                                <input v-model="editingSubmission.levelName" type="text" />
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="type-label-lg">Username</label>
                                    <input v-model="editingSubmission.username" type="text" />
                                </div>
                                <div class="form-group">
                                    <label class="type-label-lg">Percent</label>
                                    <input v-model.number="editingSubmission.percent" type="number" min="0" max="100" />
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="type-label-lg">FPS/Hz</label>
                                    <input v-model.number="editingSubmission.hz" type="number" />
                                </div>
                                <div class="form-group">
                                    <label class="type-label-lg">Discord</label>
                                    <input v-model="editingSubmission.discord" type="text" />
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="type-label-lg">Video Link</label>
                                <input v-model="editingSubmission.videoLink" type="url" />
                            </div>
                            <div class="form-group">
                                <label class="type-label-lg">Notes</label>
                                <textarea v-model="editingSubmission.notes" rows="4"></textarea>
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button @click="editingSubmission = null" class="btn-cancel">Cancel</button>
                            <button @click="saveEditedSubmission" class="btn-save" :disabled="isProcessing">Save Changes</button>
                        </div>
                    </div>
                </div>

                <div v-if="denyingSubmission" class="modal-overlay" @click.self="denyingSubmission = null">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2 class="type-headline-md">Deny Submission</h2>
                            <button class="btn-close" @click="denyingSubmission = null">✕</button>
                        </div>
                        
                        <div class="modal-body">
                            <p class="type-body">Are you sure you want to deny this submission?</p>
                            <div class="form-group">
                                <label class="type-label-lg">Reason for denial (optional)</label>
                                <textarea v-model="denyReason" placeholder="Explain why this submission is being denied..." rows="4"></textarea>
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button @click="denyingSubmission = null" class="btn-cancel">Cancel</button>
                            <button @click="confirmDeny" class="btn-deny" :disabled="isProcessing">Confirm Deny</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    `,
    methods: {
        renderTurnstile() {
            if (!window.turnstile) return;

            this.turnstileToken = null;
            this.turnstileWidgetId = null;

            const SITEKEY = '0x4AAAAAAClZM2Ug4vdAxfJI';

            this.$nextTick(() => {
                const targetId = this.submissionType === 'record' ? '#turnstile-record' : '#turnstile-level';
                const el = document.querySelector(targetId);

                if (el) {
                    el.innerHTML = ''; 
                    this.turnstileWidgetId = window.turnstile.render(targetId, {
                        sitekey: SITEKEY,
                        theme: 'dark',
                        callback: (token) => {
                            this.turnstileToken = token;
                            this.turnstileError = '';
                        },
                        'expired-callback': () => {
                            this.turnstileToken = null;
                            if (this.turnstileWidgetId !== null) {
                                window.turnstile.reset(this.turnstileWidgetId);
                            }
                        },
                        'error-callback': () => {
                            this.turnstileToken = null;
                            this.turnstileError = 'Security check failed. Please refresh the page.';
                        }
                    });
                }
            });
        },
        selectLevel(level) {
            this.formData.levelName = level.name;
            this.minPercent = level.percentToQualify || 0;
            this.formData.percent = this.minPercent;
        },
        getTurnstileToken() {
            return new Promise((resolve) => {
                if (this.turnstileToken) {
                    resolve(this.turnstileToken);
                } else {
                    if (window.turnstile && this.turnstileWidgetId !== null) {
                        try {
                            window.turnstile.execute(this.turnstileWidgetId);
                            this.turnstileError = 'Verifying connection... Please click submit again in just a moment.';
                        } catch (e) {
                            this.turnstileError = 'Security check error. Please refresh the page.';
                        }
                        resolve(null);
                    } else {
                        this.turnstileError = 'Security check is still verifying. Please wait a second and try again.';
                        resolve(null);
                    }
                }
            });
        },
        async submitRecord() {
            this.turnstileError = '';
            
            const turnstileToken = await this.getTurnstileToken();
            if (!turnstileToken) return;

            this.isSubmitting = true;
            this.errorMessage = '';
            this.successMessage = '';

            try {
                const submissionData = {
                    ...this.formData,
                    turnstileToken
                };

                const response = await fetch('/api/update-records?action=submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submissionData)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to submit record');
                }

                this.successMessage = 'Record submitted successfully! Staff will review it soon.';
                this.formData = {
                    levelName: '',
                    username: '',
                    percent: '',
                    hz: '',
                    discord: '',
                    videoLink: '',
                    notes: ''
                };
                this.levelSearchInput = '';
                
                if (window.turnstile && this.turnstileWidgetId !== null) {
                    window.turnstile.reset(this.turnstileWidgetId);
                    this.turnstileToken = null;
                }
            } catch (error) {
                this.errorMessage = error.message;
            } finally {
                this.isSubmitting = false;
            }
        },
        async submitLevel() {
            this.turnstileError = '';
            
            const turnstileToken = await this.getTurnstileToken();
            if (!turnstileToken) return;

            this.isSubmitting = true;
            this.errorMessage = '';
            this.successMessage = '';

            try {
                const submissionData = {
                    submission_type: 'level',
                    ...this.levelFormData,
                    turnstileToken
                };

                const response = await fetch('/api/update-records?action=submit-level', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submissionData)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to submit level');
                }

                this.successMessage = 'Level submitted successfully! Staff will review it soon.';
                this.levelFormData = {
                    name: '',
                    id: '',
                    author: '',
                    verifier: '',
                    verification: '',
                    percentToQualify: 100,
                    placementSuggestion: '',
                    notes: ''
                };
                
                if (window.turnstile && this.turnstileWidgetId !== null) {
                    window.turnstile.reset(this.turnstileWidgetId);
                    this.turnstileToken = null;
                }
            } catch (error) {
                this.errorMessage = error.message;
            } finally {
                this.isSubmitting = false;
            }
        },
        async loadSubmissions() {
            this.loading = true;
            try {
                const token = localStorage.getItem('admin_token');
                const response = await fetch(`/api/update-records?action=view`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        this.userRole = null;
                        return;
                    }
                    throw new Error('Failed to load submissions');
                }

                const data = await response.json();
                this.submissions = data.submissions || [];
                this.userRole = data.userRole;
            } catch (error) {
                console.error('Error loading submissions:', error);
            } finally {
                this.loading = false;
            }
        },
        async approveSubmission(id) {
            this.isProcessing = true;
            try {
                const token = localStorage.getItem('admin_token');
                const response = await fetch('/api/update-records?action=process', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ id, action: 'approve' })
                });

                if (!response.ok) throw new Error('Failed to approve submission');

                await this.loadSubmissions();
            } catch (error) {
                alert('Error approving submission: ' + error.message);
            } finally {
                this.isProcessing = false;
            }
        },
        denySubmission(submission) {
            this.denyingSubmission = submission;
            this.denyReason = '';
        },
        async confirmDeny() {
            if (!this.denyingSubmission) return;

            this.isProcessing = true;
            try {
                const token = localStorage.getItem('admin_token');
                const response = await fetch('/api/update-records?action=process', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        id: this.denyingSubmission.id,
                        action: 'deny',
                        reason: this.denyReason
                    })
                });

                if (!response.ok) throw new Error('Failed to deny submission');

                this.denyingSubmission = null;
                this.denyReason = '';
                await this.loadSubmissions();
            } catch (error) {
                alert('Error denying submission: ' + error.message);
            } finally {
                this.isProcessing = false;
            }
        },
        editSubmission(submission) {
            this.editingSubmission = { ...submission };
        },
        async saveEditedSubmission() {
            if (!this.editingSubmission) return;

            this.isProcessing = true;
            try {
                const token = localStorage.getItem('admin_token');
                const response = await fetch('/api/update-records?action=edit-submission', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(this.editingSubmission)
                });

                if (!response.ok) throw new Error('Failed to save changes');

                this.editingSubmission = null;
                await this.loadSubmissions();
            } catch (error) {
                alert('Error saving changes: ' + error.message);
            } finally {
                this.isProcessing = false;
            }
        },
        formatDate(dateString) {
            return new Date(dateString).toLocaleString();
        },
        async loadLevels() {
            try {
                const list = await fetchList();
                this.levels = list || [];
            } catch (error) {
                this.levels = [];
            }
        }
    },
    mounted() {
        if (!window.turnstile) {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                this.renderTurnstile();
            };
            document.head.appendChild(script);
        } else {
            this.$nextTick(() => {
                this.renderTurnstile();
            });
        }

        const token = localStorage.getItem('admin_token');
        if (token) {
            this.loadSubmissions();
        }
        this.loadLevels();
    },
    beforeUnmount() {
        if (window.turnstile && this.turnstileWidgetId !== null) {
            try {
                window.turnstile.remove(this.turnstileWidgetId);
            } catch (e) {}
        }
    }
};
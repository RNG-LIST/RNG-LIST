import { store } from '../main.js';
import { fetchList, fetchRules, fetchPacks } from '../content.js';
import Spinner from '../components/Spinner.js';

export default {
    components: { Spinner },
    template: `
        <main v-if="loading" class="loading-container">
            <Spinner></Spinner>
        </main>

        <main v-else-if="!isAuthenticated" class="page-login">
            <div class="login-card">
                <h2>Admin Access</h2>
                <form @submit.prevent="handleLogin" class="admin-form">
                    <div class="form-group"><label>Username</label><input v-model="loginUsername" type="text" required /></div>
                    <div class="form-group"><label>Email</label><input v-model="loginEmail" type="email" required /></div>
                    <div class="form-group"><label>Password</label><input v-model="loginPassword" type="password" required /></div>
                    <button type="submit" class="btn-submit" :disabled="isLoggingIn">{{ isLoggingIn ? 'Verifying...' : 'Login' }}</button>
                    <div v-if="loginError" class="message error-message">{{ loginError }}</div>
                </form>
            </div>
        </main>

        <main v-else class="page-admin">
            <aside class="admin-sidebar">
                <div class="sidebar-header">
                    <h2>{{ userRole === 'mod' ? 'Mod Panel' : 'Admin Panel' }}</h2>
                    <button @click="logout" class="btn-logout">Logout</button>
                </div>
                
                <div class="sidebar-tabs">
                    <button :class="{ active: currentTab === 'submissions' }" @click="currentTab = 'submissions'">Submissions</button>
                    <button :class="{ active: currentTab === 'levels' }" @click="currentTab = 'levels'">Levels</button>
                    <button v-if="userRole !== 'mod'" :class="{ active: currentTab === 'packs' }" @click="currentTab = 'packs'">Packs</button>
                </div>

                <div v-if="currentTab === 'levels'">
                    <button v-if="userRole !== 'mod'" @click="openRulesModal" class="btn-toggle" style="margin-bottom: 1.5rem;">Edit Rules</button>
                    <h3 style="border-bottom: 1px solid var(--color-border); padding-bottom: 5px;">Add Level</h3>
                    <form @submit.prevent="submitLevel" class="admin-form" style="margin-top: 1rem;" :style="userRole === 'mod' ? 'opacity: 0.5; pointer-events: none;' : ''">
                        <div v-if="userRole === 'mod'" style="background: rgba(255, 183, 0, 0.1); border-left: 3px solid #ffb700; padding: 10px; margin-bottom: 1.5rem; border-radius: 4px; font-size: 0.9rem; pointer-events: auto;">
                            <strong>Mods cannot add levels</strong><br>
                            Only Admins and above can add new levels!
                        </div>
                        <div class="form-group"><label>Name</label><input v-model="formData.name" type="text" required /></div>
                        <div class="form-group"><label>ID</label><input v-model.number="formData.id" type="number" required /></div>
                        <div class="form-group"><label>Author</label><input v-model="formData.author" type="text" placeholder="Name, Name2..." required /></div>
                        <div class="form-group"><label>Verifier</label><input v-model="formData.verifier" type="text" required /></div>
                        <div class="form-group"><label>Video</label><input v-model="formData.verification" type="text" placeholder="https://youtu.be/..." required /></div>
                        <div style="display:flex; gap:10px;">
                            <div style="flex:1"><label>Percent</label><input v-model.number="formData.percentToQualify" type="number" min="0" max="100" required /></div>
                            <div style="flex:1"><label>Placement</label><input v-model.number="formData.placement" type="number" :placeholder="'Max: ' + maxPlacement" /></div>
                        </div>
                        <button type="button" @click="toggleRecordSection" class="btn-toggle">{{ showRecords ? '▼ Hide Records' : '► Add Initial Records' }}</button>
                        <div v-if="showRecords" class="records-section">
                            <div v-for="(record, index) in formData.records" :key="index" class="record-item">
                                <div class="record-header"><span>Record {{ index + 1 }}</span><button type="button" @click="removeRecord(index)" class="btn-remove">Remove</button></div>
                                <input v-model="record.user" placeholder="User" style="margin-bottom:5px;" required />
                                <input v-model="record.link" placeholder="Link" style="margin-bottom:5px;" required />
                                <div class="record-row">
                                    <input v-model.number="record.percent" placeholder="%" />
                                    <input v-model.number="record.hz" placeholder="Hz" />
                                </div>
                            </div>
                            <button type="button" @click="addRecord" class="btn-add-record">+ Add Record</button>
                        </div>
                        <button type="submit" class="btn-submit" :disabled="isSubmitting">{{ isSubmitting ? 'Saving...' : 'Add Level' }}</button>
                        <div v-if="successMessage" class="message success-message">✓ {{ successMessage }}</div>
                        <div v-if="errorMessage" class="message error-message">✗ {{ errorMessage }}</div>
                    </form>
                </div>

                <div v-if="currentTab === 'packs'">
                    <button @click="createNewPack" class="btn-submit" style="margin-bottom: 1.5rem;">+ Create New Pack</button>
                    
                    <h3 style="border-bottom: 1px solid var(--color-border); padding-bottom: 5px;">All Packs</h3>
                    <div style="display:flex; flex-direction:column; gap: 8px; margin-top: 1rem;">
                        <div v-if="packsList.length === 0" style="color:var(--color-text-secondary); font-style:italic;">No packs yet.</div>
                        <div v-for="pack in packsList" :key="pack.id" 
                             class="pack-card-mini" 
                             :class="{ active: editingPack.original_id === pack.id }"
                             @click="selectPack(pack)">
                            <div class="pack-info">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <div :style="{width:'10px', height:'10px', borderRadius:'50%', background: pack.color || '#fff'}"></div>
                                    <strong>{{ pack.name }}</strong>
                                </div>
                                <small>{{ pack.levels ? pack.levels.length : 0 }} Levels</small>
                            </div>
                            <button class="btn-icon-sm" @click.stop="deletePack(pack)">🗑</button>
                        </div>
                    </div>
                </div>
                <div style="margin-top: auto;">
                    <button class="btn-goto-admin" onclick="window.location.href='/#/manage'">
                        Go To Management Page
                    </button>
                </div>
            </aside>

            <section class="admin-content">
                <div v-if="currentTab === 'submissions'" class="submissions-list">
                    <div class="list-header">
                        <h2>Pending Submissions ({{ submissions.length }})</h2>
                        <div style="display: flex; gap: 10px;">
                            <button @click="submissionViewType = 'record'" 
                                    :class="{ active: submissionViewType === 'record' }"
                                    style="padding: 0.5rem 1rem; border: 2px solid var(--color-border); border-radius: 0.4rem; background: none; color: var(--color-text); cursor: pointer; transition: all 0.2s;"
                                    :style="submissionViewType === 'record' ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}">
                                Submitted Records ({{ submissions.filter(s => (s.submission_type || 'record') === 'record').length }})
                            </button>
                            
                            <button @click="submissionViewType = 'level'" 
                                    :disabled="userRole === 'mod'"
                                    :title="userRole === 'mod' ? 'Mods cannot review level submissions' : ''"
                                    :class="{ active: submissionViewType === 'level' }"
                                    style="padding: 0.5rem 1rem; border: 2px solid var(--color-border); border-radius: 0.4rem; color: var(--color-text); transition: all 0.2s;"
                                    :style="[
                                        submissionViewType === 'level' ? { background: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : { background: 'none' },
                                        userRole === 'mod' ? { opacity: 0.5, cursor: 'not-allowed' } : { cursor: 'pointer' }
                                    ]">
                                Submitted Levels ({{ submissions.filter(s => (s.submission_type || 'record') === 'level').length }})
                            </button>
                        </div>
                    </div>
                    
                    <div v-if="filteredSubmissions.length === 0" class="no-submissions">
                        <p style="color: var(--color-text-secondary); font-style: italic; padding: 2rem 0;">No pending {{ submissionViewType }} submissions at the moment.</p>
                    </div>

                    <div v-if="submissionViewType === 'record' && filteredSubmissions.length > 0" class="submissions-container" style="overflow-x: auto;">
                        <table class="submissions-table">
                            <thead>
                                <tr>
                                    <th>Level</th>
                                    <th>Player</th>
                                    <th>Discord</th>
                                    <th>Percent</th>
                                    <th>FPS</th>
                                    <th>Video</th>
                                    <th>Notes</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="submission in filteredSubmissions" :key="submission.id" class="submission-row">
                                    <td><strong :title="submission.level_name">{{ submission.level_name }}</strong></td>
                                    <td><input v-model="submission.username" type="text" class="inline-input" style="width: 140px;" :title="submission.username" /></td>
                                    <td><input v-model="submission.discord" type="text" class="inline-input" style="width: 140px;" :title="submission.discord" /></td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 4px;">
                                            <input v-model.number="submission.percent" type="number" class="inline-input" style="width: 80px;" :title="submission.percent" />%
                                        </div>
                                    </td>
                                    <td><input v-model.number="submission.hz" type="number" class="inline-input" style="width: 80px;" :title="submission.hz" /></td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <input v-model="submission.video_link" type="text" class="inline-input" style="width: 160px;" :title="submission.video_link" />
                                            <a :href="submission.video_link" target="_blank" title="Watch Video">🔗</a>
                                        </div>
                                    </td>
                                    <td><input v-model="submission.notes" type="text" class="inline-input" style="width: 180px;" placeholder="No notes" :title="submission.notes" /></td>
                                    <td class="actions">
                                        <button @click="approveSubmission(submission)" class="btn-approve" :disabled="isProcessing" title="Approve">✓</button>
                                        <button @click="openDenyModal(submission)" class="btn-deny" :disabled="isProcessing" title="Deny">✕</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div v-if="submissionViewType === 'level' && filteredSubmissions.length > 0" class="submissions-container" style="overflow-x: auto;">
                        <table class="submissions-table">
                            <thead>
                                <tr>
                                    <th>Level Name</th>
                                    <th>ID</th>
                                    <th>Author</th>
                                    <th>Verifier</th>
                                    <th>Video</th>
                                    <th>Placement</th>
                                    <th>Notes</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="submission in filteredSubmissions" :key="submission.id" class="submission-row">
                                    <td><input v-model="submission.name" type="text" class="inline-input" style="width: 180px; font-weight: bold;" :title="submission.name" /></td>
                                    <td><input v-model.number="submission.id_gd" type="number" class="inline-input" style="width: 120px;" :title="submission.id_gd" /></td>
                                    <td><input v-model="submission.author" type="text" class="inline-input" style="width: 140px;" :title="submission.author" /></td>
                                    <td><input v-model="submission.verifier" type="text" class="inline-input" style="width: 140px;" :title="submission.verifier" /></td>
                                    <td>
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <input v-model="submission.verification" type="text" class="inline-input" style="width: 160px;" :title="submission.verification" />
                                            <a :href="submission.verification" target="_blank" title="Watch Video">🔗</a>
                                        </div>
                                    </td>
                                    <td>
                                        <input v-model.number="submission.placement_suggestion" 
                                               type="number" 
                                               min="1" 
                                               :max="maxPlacement" 
                                               class="inline-input"
                                               style="width: 80px;"
                                               :title="submission.original_placement_suggestion || 'No placement info provided'" />
                                    </td>
                                    <td><input v-model="submission.notes" type="text" class="inline-input" style="width: 180px;" placeholder="No notes" :title="submission.notes" /></td>
                                    <td class="actions">
                                        <button @click="approveSubmission(submission)" class="btn-approve" :disabled="isProcessing || userRole === 'mod'" title="Admins/Managers only">✓</button>
                                        <button @click="openDenyModal(submission)" class="btn-deny" :disabled="isProcessing || userRole === 'mod'" title="Admins/Managers only">✕</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div> <div v-if="currentTab === 'levels'">
                    <div class="list-header">
                        <h2>Levels ({{ levelsList.length }})</h2>
                        <input v-model="searchQuery" type="text" placeholder="Search levels..." class="search-input" />
                    </div>
                    
                    <div class="table-container" ref="tableContainer">
                        <table class="levels-table">
                            <thead><tr><th>Rank</th><th>Name</th><th>Records</th><th>Actions</th></tr></thead>
                            <tbody>
                                <tr v-for="(level, index) in filteredLevels" 
                                    :key="level._id" 
                                    class="level-row" 
                                    :draggable="!searchQuery && userRole !== 'mod'" 
                                    @dragstart="onDragStart($event, index)" 
                                    @dragover.prevent="onDragOver($event, index)" 
                                    @drop.prevent="onDrop"
                                    @dragend="onDragEnd"
                                    :class="{ 'is-dragging': draggedItem && draggedItem._id === level._id }"
                                >
                                    <td>
                                        <div class="rank-display-wrapper">
                                            <span :class="index + 1 <= 150 ? 'goldhighlight' : ''" 
                                                  :style="index + 1 > 150 ? 'color: var(--color-text-legacy)' : ''"
                                                  style="font-size: 1.2rem; font-weight: bold;">
                                                #{{ index + 1 }}
                                            </span>
                                            <span class="drag-handle" v-if="!searchQuery && userRole !== 'mod'">::</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style="font-weight:700;">{{ level.name }}</span>
                                    </td>
                                    <td>{{ level.records?.length || 0 }}</td>
                                    <td class="actions">
                                        <button class="btn-icon" @click.stop="openEditRecordsModal(level)">✎</button>
                                        <button v-if="userRole !== 'mod'" class="btn-icon" @click.stop="deleteLevel(level)">🗑</button>
                                        <button v-else disabled class="btn-icon" style="opacity: 0.4; cursor: not-allowed;" title="Only admins can delete levels">🗑</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div v-if="currentTab === 'packs'" class="pack-workspace">
                    <div class="pack-header-bar">
                        <div class="pack-meta-inputs">
                            <div style="flex: 2;">
                                <label>Pack Name</label>
                                <input v-model="editingPack.name" type="text" placeholder="e.g. Map Pack 1" />
                            </div>
                            <div style="flex: 0 0 100px;">
                                <label>Color</label>
                                <input v-model="editingPack.color" type="color" style="height: 43px; padding: 2px; cursor: pointer;" />
                            </div>
                        </div>
                        <div style="margin-left: 2rem;">
                            <button @click="savePack" class="btn-submit" :disabled="isSavingPack" style="width: auto; padding: 12px 30px;">
                                {{ isSavingPack ? 'Saving...' : 'Save Pack' }}
                            </button>
                        </div>
                    </div>
                    <div v-if="packMessage" :class="packError ? 'error-message' : 'success-message'" style="margin-bottom: 1rem;">{{ packMessage }}</div>

                    <div class="pack-drag-container">
                        <div class="drag-column">
                            <h3>Levels In Pack ({{ editingPack.levels.length }})</h3>
                            
                            <div class="drag-list" ref="packListContainer" @dragover.prevent @drop="onDropToPack($event)">
                                <div v-if="editingPack.levels.length === 0" style="text-align:center; color:var(--color-text-secondary); padding:2rem; font-style:italic; border: 2px dashed var(--color-border); border-radius: 8px;">
                                    Drag levels here from the right list
                                </div>
                                <div v-for="(lvl, idx) in editingPack.levels" :key="'p-'+lvl._id" 
                                     class="drag-item" 
                                     draggable="true"
                                     @dragstart="onDragStartPack($event, idx)" 
                                     @dragover.prevent="onDragOverPack($event, idx)" 
                                     @drop.stop
                                     :class="{ 'is-dragging': draggedPackIndex === idx }">
                                    <span>{{ lvl.name }} <small style="opacity:0.5">({{ lvl.id }})</small></span>
                                    <button @click="removeFromPack(idx)" class="btn-icon-sm">✕</button>
                                </div>
                            </div>
                        </div>
                        <div class="drag-column">
                            <h3>Available Levels</h3>
                            <input v-model="packSearch" placeholder="Search levels..." style="margin-bottom: 1rem;" />
                            <div class="drag-list">
                                <div v-for="lvl in filteredAvailableLevels" :key="'a-'+lvl._id" 
                                     class="drag-item source" draggable="true"
                                     @dragstart="onDragStartSource($event, lvl)" @click="addToPack(lvl)">
                                    <div>
                                        <span :class="getOriginalIndex(lvl) <= 150 ? 'goldhighlight' : ''" 
                                              :style="getOriginalIndex(lvl) > 150 ? 'color: var(--color-text-legacy)' : ''"
                                              style="margin-right:8px;">
                                            #{{ getOriginalIndex(lvl) }}
                                        </span> 
                                        {{ lvl.name }} <small style="opacity:0.5">({{ lvl.author }})</small>
                                    </div>
                                    <span class="goldhighlight">+</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div v-if="showRulesModal" class="modal-overlay" @click="closeRulesModal">
                <div class="polished-modal rules-modal" @click.stop style="max-width: 95vw; height: 90vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <h1>Edit Rules</h1>
                        <button class="modal-close-btn" @click="closeRulesModal">✕</button>
                    </div>
                    
                    <div class="rules-container" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px;">
                        
                        <div v-for="(section, idx) in rulesSections" :key="idx" class="rule-section-card">
                            <div class="section-header-row">
                                <input v-model="section.header" placeholder="Section Header (e.g. Record Rules)" class="header-input" />
                                <div class="section-controls">
                                    <label class="toggle-switch">
                                        <input type="checkbox" v-model="section.visible" class="checkboxswitch">
                                        <span class="slider"></span>
                                        <span class="label-text">{{ section.visible ? 'Visible' : 'Hidden' }}</span>
                                    </label>
                                    <button @click="removeRuleSection(idx)" class="btn-remove">Remove Section</button>
                                </div>
                            </div>
                            
                            <div class="section-body">
                                <div class="editor-column">
                                    <label>Rules (Markdown supported, one per line)</label>
                                    <textarea v-model="section.text" class="rules-textarea" placeholder="- Rule 1..."></textarea>
                                </div>
                                <div class="preview-column">
                                    <label>Preview</label>
                                    <div class="markdown-preview-box">
                                        <h3 class="type-headline-sm" style="margin-bottom:10px;">{{ section.header }}</h3>
                                        <div v-for="(line, lIdx) in getPreviewLines(section.text)" 
                                             :key="lIdx" 
                                             class="preview-line"
                                             v-html="renderMarkdown(line)">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button @click="addRuleSection" class="btn-toggle" style="align-self: center; padding: 10px 20px;">+ Add New Rule Section</button>

                    </div>

                    <div class="modal-footer">
                        <div v-if="rulesMessage" :class="rulesError ? 'message error-message' : 'message success-message'" style="margin-right: auto; margin-left: 20px;">
                            {{ rulesMessage }}
                        </div>
                        <button @click="saveRules" class="btn-submit" :disabled="isSavingRules">
                            {{ isSavingRules ? 'Saving...' : 'Save All Rules' }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="editingRecordsLevel" class="modal-overlay" @click="closeEditRecordsModal">
                <div class="polished-modal" @click.stop style="max-width: 800px;">
                    <div class="modal-header"><h1>Edit: {{ editingLevel.name }}</h1><button class="modal-close-btn" @click="closeEditRecordsModal">✕</button></div>
                    <div class="modal-scroll-area">
                        <div class="admin-form">
                            <div><label>Name</label><input v-model="editingLevel.name"></div>
                            <div><label>Author</label><input v-model="editingLevel.author" placeholder="Name, Name2..."></div>
                            <div><label>Verifier</label><input v-model="editingLevel.verifier"></div>
                            <div><label>ID</label><input v-model.number="editingLevel.id"></div>
                            <div><label>Video</label><input v-model="editingLevel.verification"></div>
                            <div><label>Percent</label><input v-model="editingLevel.percentToQualify"></div>
                        </div>
                        <h3 style="margin-top:2rem;">Records</h3>
                        <div v-for="(record, index) in editingLevel.records" :key="index" style="display:flex; gap:5px; margin-bottom:5px;">
                            <input v-model="record.user" placeholder="User" style="flex:1">
                            <input v-model="record.link" placeholder="Link" style="flex:1">
                            <input v-model.number="record.percent" placeholder="%" style="width:60px">
                            <input v-model.number="record.hz" placeholder="Hz" style="width:60px">
                            <button @click="editingLevel.records.splice(index, 1)" class="btn-icon-sm" style="font-size:1.2rem;">✕</button>
                        </div>
                        <button @click="addEditingRecord" class="btn-toggle" style="margin-top:5px;">+ Add Record</button>
                    </div>
                    <div class="modal-footer">
                        <div v-if="editRecordsMessage" :class="editRecordsError ? 'message error-message' : 'message success-message'" style="margin-right: auto;">
                            {{ editRecordsMessage }}
                        </div>
                        <button @click="saveEditLevel" class="btn-submit" :disabled="isSavingRecords">{{ isSavingRecords ? 'Saving...' : 'Save Changes' }}</button>
                    </div>
                </div>
            </div>

            <div v-if="denyingSubmission" class="modal-overlay" @click="closeDenyModal">
                <div class="polished-modal" @click.stop style="max-width: 500px;">
                    <div class="modal-header">
                        <h1>Deny Submission</h1>
                        <button class="modal-close-btn" @click="closeDenyModal">✕</button>
                    </div>
                    <div class="modal-scroll-area">
                        <p style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">
                            Submitted by: <strong>{{ denyingSubmission.username || 'System/Self' }}</strong><br>
                            Level: <strong>{{ denyingSubmission.name || denyingSubmission.level_name }}</strong>
                        </p>
                        <div class="admin-form">
                            <label>Denial Reason (send to user)</label>
                            <textarea v-model="denyReason" 
                                placeholder="e.g., Video quality too low, Percent seems inaccurate, etc." 
                                rows="6" 
                                style="font-family: monospace; font-size: 0.95rem;"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button @click="closeDenyModal" class="btn-secondary">Cancel</button>
                        <button @click="confirmDeny" class="btn-deny" :disabled="isProcessing">
                            {{ isProcessing ? 'Processing...' : 'Confirm Deny' }}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    `,
    data() {
        return {
            store, loading: true, isAuthenticated: false, currentTab: 'submissions',
            loginUsername: '', loginEmail: '', loginPassword: '', isLoggingIn: false, loginError: '', token: null, userRole: null,
            
            submissions: [], 
            submissionViewType: 'record', 
            isProcessing: false, 
            denyingSubmission: null, 
            denyReason: '',
            optimisticallyRemovedIds: new Set(),

            levelsList: [], searchQuery: '', formData: { id: null, name: '', author: '', verifier: '', verification: '', percentToQualify: 100, password: 'free Copyable', records: [], creators: [], placement: null },
            showRecords: false, isSubmitting: false, successMessage: '', errorMessage: '',

            packsList: [],
            editingPack: { name: '', pack_id: '', original_id: null, color: '#ff69e1', levels: [] },
            packSearch: '', isSavingPack: false, packMessage: '', packError: false, draggedSourceLevel: null, draggedPackIndex: null,

            authInterval: null, 
            
            showRulesModal: false, 
            rulesSections: [], 
            rulesMessage: '',
            rulesError: false,
            isSavingRules: false,

            editingRecordsLevel: null, editingLevel: null, isSavingRecords: false, recordsSuccessMessage: '', editRecordsMessage: '', editRecordsError: false, draggedItem: null, dragStartIndex: null, scrollInterval: null,
            pollingInterval: null, lastSubmissionCount: 0, lastLevelCount: 0,
        };
    },
    computed: {
        maxPlacement() { 
            return (this.levelsList && this.levelsList.length ? this.levelsList.length : 0) + 1; 
        },
        filteredLevels() {
            if (!this.searchQuery) return this.levelsList;
            const q = this.searchQuery.toLowerCase();
            return this.levelsList.filter(l => l.name.toLowerCase().includes(q) || String(l.id).toLowerCase().includes(q));
        },
        filteredAvailableLevels() {
            const q = this.packSearch.toLowerCase();
            const inPackIds = new Set(this.editingPack.levels.map(l => l._id));
            return this.levelsList.filter(l => (l.name.toLowerCase().includes(q)) && !inPackIds.has(l._id));
        },
        filteredSubmissions() {
            return this.submissions.filter(s => {
                const type = s.submission_type || 'record';
                return type === this.submissionViewType;
            });
        }
    },
    async mounted() {
        if (!document.querySelector('style#inline-input-styles')) {
            const style = document.createElement('style');
            style.id = 'inline-input-styles';
            style.innerHTML = `
                .inline-input {
                    padding: 4px 6px;
                    border: 1px solid var(--color-border);
                    border-radius: 4px;
                    background: var(--color-bg-secondary);
                    color: var(--color-text);
                    font-family: inherit;
                    box-sizing: border-box;
                }
                .inline-input:focus {
                    outline: none;
                    border-color: var(--color-primary);
                }
            `;
            document.head.appendChild(style);
        }

        if (!document.querySelector('link[href="/css/pages/admin.css"]')) {
            const link = document.createElement('link'); 
            link.rel = 'stylesheet'; 
            link.href = '/css/pages/admin.css'; 
            document.head.appendChild(link);
        }

        try {
            const storedToken = localStorage.getItem('admin_token');
            const storedRole = localStorage.getItem('admin_role');
            if (storedToken) {
                this.token = storedToken;
                this.userRole = storedRole;
                this.isAuthenticated = true;
                
                await this.refreshLevels();
                await this.loadSubmissions();
                await this.refreshPacks();
                
                this.startAuthCheck();
                this.startPolling();
            }
        } catch (e) {
            console.error("Initialization error:", e);
        } finally {
            this.loading = false;
        }
    },
    beforeUnmount() {
        this.stopAuthCheck();
        this.stopPolling();
    },
    methods: {
        async handleLogin() {
            this.isLoggingIn = true;
            try {
                const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: this.loginUsername, email: this.loginEmail, password: this.loginPassword }) });
                const data = await res.json();
                if (res.ok && data.success) {
                    this.token = data.token;
                    this.userRole = data.role;
                    localStorage.setItem('admin_token', data.token);
                    localStorage.setItem('admin_role', data.role);
                    this.isAuthenticated = true;
                    
                    await this.refreshLevels();
                    await this.loadSubmissions();
                    await this.refreshPacks();
                    
                    this.startAuthCheck();
                } else {
                    this.loginError = data.error || 'Failed';
                }
            } catch (e) { this.loginError = 'Error'; } finally { this.isLoggingIn = false; }
        },
        logout() {
            this.stopAuthCheck();
            this.isAuthenticated = false;
            this.token = null;
            this.userRole = null;
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_role');
        },
        getAuthHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` }; },

        startAuthCheck() {
            this.stopAuthCheck();
            this.checkToken();
            this.authInterval = setInterval(() => this.checkToken(), 30000); 
        },
        stopAuthCheck() {
            if (this.authInterval) { clearInterval(this.authInterval); this.authInterval = null; }
        },
        async checkToken() {
            if (!this.token) return;
            try {
                const res = await fetch('/api/login', { method: 'GET', headers: this.getAuthHeaders() });
                if (res.status === 401) { this.logout(); }
            } catch (e) { console.error("Auth check failed"); }
        },

        startPolling() {
            this.stopPolling();
            this.pollingInterval = setInterval(() => this.pollForUpdates(), 10000);
        },
        stopPolling() {
            if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; }
        },
        async pollForUpdates() {
            if (!this.isAuthenticated) return;
            try {
                const subRes = await fetch(`/api/update-records?action=view&_t=${Date.now()}`, {
                    method: 'GET',
                    headers: this.getAuthHeaders()
                });
                if (subRes.ok) {
                    const subData = await subRes.json();
                    const newSubCount = subData.submissions?.length || 0;
                    if (newSubCount !== this.lastSubmissionCount) {
                        this.processIncomingSubmissions(subData.submissions || []);
                        this.lastSubmissionCount = newSubCount;
                    }
                }

                if (this.currentTab === 'levels' && !this.draggedItem) {
                    await this.refreshLevels();
                }
            } catch (e) { console.error("Polling error:", e); }
        },

        processIncomingSubmissions(rawSubmissions) {
            const max = this.maxPlacement || 1;
            
            const validSubmissions = rawSubmissions.filter(sub => !this.optimisticallyRemovedIds.has(sub.id));
            
            this.submissions = validSubmissions.map(sub => {
                try {
                    if (sub.submission_type === 'level') {
                        sub.original_placement_suggestion = sub.placement_suggestion;
                        let parsed = parseInt(sub.placement_suggestion);
                        if (isNaN(parsed) || parsed < 1) parsed = max;
                        if (parsed > max) parsed = max;
                        sub.placement_suggestion = parsed;
                    }
                } catch (e) {
                    sub.placement_suggestion = max;
                }
                return sub;
            });
        },

        async loadSubmissions() {
            try {
                const res = await fetch(`/api/update-records?action=view&_t=${Date.now()}`, {
                    method: 'GET',
                    headers: this.getAuthHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    this.processIncomingSubmissions(data.submissions || []);
                } else if (res.status !== 401) {
                    console.error('Failed to load submissions');
                }
            } catch (error) {
                console.error('Error loading submissions:', error);
            }
        },
        
        async approveSubmission(submission) {
            this.isProcessing = true;
            
            const index = this.submissions.findIndex(s => s.id === submission.id);
            if (index === -1) {
                this.isProcessing = false;
                return;
            }
            this.optimisticallyRemovedIds.add(submission.id);
            const backupSubmission = { ...this.submissions[index] };
            this.submissions.splice(index, 1);

            try {
                let finalPlacement = submission.placement_suggestion;
                if (submission.submission_type === 'level') {
                    finalPlacement = parseInt(finalPlacement);
                    if (isNaN(finalPlacement) || finalPlacement < 1) finalPlacement = this.maxPlacement;
                    if (finalPlacement > this.maxPlacement) finalPlacement = this.maxPlacement;
                }

                const payload = {
                    id: submission.id,
                    action: 'approve',
                    username: submission.username,
                    discord: submission.discord,
                    percent: submission.percent,
                    hz: submission.hz,
                    video_link: submission.video_link,
                    name: submission.name,
                    id_gd: submission.id_gd,
                    author: submission.author,
                    verifier: submission.verifier,
                    verification: submission.verification,
                    percent_to_qualify: submission.percent_to_qualify,
                    placement_suggestion: finalPlacement,
                    notes: submission.notes
                };

                const res = await fetch('/api/update-records?action=process', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    if (submission.submission_type === 'level') {
                        this.refreshLevels();
                    }
                } else {
                    throw new Error('Server rejected the approval.');
                }
            } catch (error) {
                this.optimisticallyRemovedIds.delete(submission.id);
                this.submissions.splice(index, 0, backupSubmission);
                alert('Failed to approve submission: ' + error.message);
            } finally {
                this.isProcessing = false;
            }
        },
        
        openDenyModal(submission) {
            this.denyingSubmission = submission;
            this.denyReason = '';
        },
        closeDenyModal() {
            this.denyingSubmission = null;
            this.denyReason = '';
        },

        async confirmDeny() {
            if (!this.denyingSubmission) return;
            this.isProcessing = true;
            
            const submissionIdToDeny = this.denyingSubmission.id;
            const denyReasonToSend = this.denyReason;
            
            const index = this.submissions.findIndex(s => s.id === submissionIdToDeny);
            let backupSubmission = null;
            if (index !== -1) {
                this.optimisticallyRemovedIds.add(submissionIdToDeny);
                backupSubmission = { ...this.submissions[index] };
                this.submissions.splice(index, 1);
            }
            
            this.closeDenyModal();

            try {
                const res = await fetch('/api/update-records?action=process', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({
                        id: submissionIdToDeny,
                        action: 'deny',
                        reason: denyReasonToSend
                    })
                });
                
                if (!res.ok) {
                    throw new Error('Server rejected the denial.');
                }
            } catch (error) {
                if (backupSubmission && index !== -1) {
                    this.optimisticallyRemovedIds.delete(submissionIdToDeny);
                    this.submissions.splice(index, 0, backupSubmission);
                }
                alert('Failed to deny submission: ' + error.message);
            } finally {
                this.isProcessing = false;
            }
        },

        async refreshLevels() { 
            try {
                const list = await fetchList(); 
                if (list) this.levelsList = list.map(([l]) => l).filter(l => l); 
            } catch(e) {
                console.error('Failed to refresh levels:', e);
            }
        },
        async refreshPacks() { 
            try {
                const packs = await fetchPacks(); 
                if (packs) this.packsList = packs; 
            } catch(e) {}
        },

        createNewPack() {
            this.editingPack = { name: '', pack_id: '', original_id: null, color: '#d4c217', levels: [] };
            this.packMessage = '';
        },
        selectPack(pack) {
            const fullLevels = (pack.levels || []).map(gdId => {
                const found = this.levelsList.find(l => String(l.id) === String(gdId));
                if (found) return found;
                return { id: gdId, name: `[Other] ID: ${gdId}`, _id: 'unknown-'+gdId };
            });

            this.editingPack = {
                name: pack.name || null,
                pack_id: pack.id,
                original_id: pack.id,
                color: pack.color || '#ff2cc0',
                levels: fullLevels
            };
            this.packMessage = '';
        },

        async savePack() {
            this.isSavingPack = true; this.packMessage = '';

            let finalId = this.editingPack.original_id;
            if (!finalId && this.editingPack.name) {
                finalId = this.editingPack.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            }
            if (!finalId) { this.packMessage = 'Name required'; this.packError = true; this.isSavingPack = false; return; }

            try {
                const res = await fetch('/api/packs', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({
                        action: 'save',
                        id: finalId,
                        name: this.editingPack.name,
                        color: this.editingPack.color,
                        levels: this.editingPack.levels.map(l => String(l.id))
                    })
                });

                if (res.status === 401) { this.logout(); return; }

                if (res.ok) {
                    this.packMessage = 'Saved!';
                    await this.refreshPacks();
                    this.editingPack.original_id = finalId;
                } else {
                    this.packMessage = 'Failed'; this.packError = true;
                }
            } catch (e) { this.packMessage = 'Error'; this.packError = true; }
            finally { this.isSavingPack = false; }
        },
        async deletePack(pack) {
            if (!confirm(`Delete ${pack.name}?`)) return;
            try {
                const res = await fetch('/api/packs', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ action: 'delete', id: pack.id })
                });
                if (res.status === 401) { this.logout(); return; }
                await this.refreshPacks();
                this.createNewPack();
            } catch (e) { }
        },

        handleAutoScroll(event, container) {
            if (!container) return;
            const threshold = 60; 
            const speed = 15; 
            const rect = container.getBoundingClientRect();
            const y = event.clientY;

            if (y < rect.top + threshold) { container.scrollTop -= speed; }
            else if (y > rect.bottom - threshold) { container.scrollTop += speed; }
        },

        onDragStart(event, index) {
            if (this.searchQuery) { event.preventDefault(); return; }
            this.draggedItem = this.levelsList[index];
            this.dragStartIndex = index;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', index);
        },
        
        onDragOver(event, index) {
            this.handleAutoScroll(event, this.$refs.tableContainer);
            const draggedIdx = this.levelsList.findIndex(l => l._id === this.draggedItem._id);
            if (draggedIdx === -1 || draggedIdx === index) return;
            const item = this.levelsList.splice(draggedIdx, 1)[0];
            this.levelsList.splice(index, 0, item);
        },

        onDragEnd() { 
            this.draggedItem = null; 
            this.dragStartIndex = null;
        },

        async onDrop() {
            if (this.draggedItem === null || this.dragStartIndex === null) return;
            
            const newIndex = this.levelsList.findIndex(l => l._id === this.draggedItem._id);
            
            if (newIndex !== -1 && newIndex !== this.dragStartIndex) {
                try {
                    const res = await fetch('/api/move-level', { 
                        method: 'POST', 
                        headers: this.getAuthHeaders(), 
                        body: JSON.stringify({ 
                            oldIndex: this.dragStartIndex, 
                            newIndex: newIndex
                        }) 
                    });
                    if (res.status === 401) { this.logout(); }
                } catch (e) { await this.refreshLevels(); }
            }
            this.draggedItem = null;
            this.dragStartIndex = null;
        },

        onDragStartSource(evt, level) {
            this.draggedSourceLevel = level;
            this.draggedPackIndex = null;
            evt.dataTransfer.effectAllowed = 'copy';
        },
        onDragStartPack(evt, index) {
            this.draggedPackIndex = index;
            this.draggedSourceLevel = null;
            evt.dataTransfer.effectAllowed = 'move';
        },
        onDragOverPack(evt, index) {
            this.handleAutoScroll(evt, this.$refs.packListContainer);
            if (this.draggedPackIndex === null) return;
            const fromIndex = this.draggedPackIndex;
            if (fromIndex === index) return;
            const item = this.editingPack.levels.splice(fromIndex, 1)[0];
            this.editingPack.levels.splice(index, 0, item);
            this.draggedPackIndex = index; 
        },
        
        onDropToPack(evt) {
            if (this.draggedSourceLevel) {
                const exists = this.editingPack.levels.find(l => l._id === this.draggedSourceLevel._id);
                if (!exists) this.editingPack.levels.push(this.draggedSourceLevel);
                this.draggedSourceLevel = null;
            }
            this.draggedPackIndex = null;
        },
        
        onDropReorderPack(evt, targetIndex) {
            this.draggedPackIndex = null;
        },

        addToPack(level) { const exists = this.editingPack.levels.find(l => l._id === level._id); if (!exists) this.editingPack.levels.push(level); },
        removeFromPack(index) { this.editingPack.levels.splice(index, 1); },

        getOriginalIndex(level) { return this.levelsList.indexOf(level) + 1; },
        toggleRecordSection() { this.showRecords = !this.showRecords; },
        addRecord() { this.formData.records.push({ user: '', link: '', percent: 100, hz: 60 }); },
        removeRecord(index) { this.formData.records.splice(index, 1); },

        async submitLevel() {
            this.isSubmitting = true; this.errorMessage = '';
            
            let levelData = { ...this.formData };
            const authors = levelData.author.split(',').map(a => a.trim()).filter(a => a);

            if (authors.length > 1) {
                levelData.creators = authors;
                levelData.author = authors[0];
            }

            const payload = { 
                levelData: levelData, 
                placement: this.formData.placement
            };
            delete payload.levelData.placement;

            try {
                const res = await fetch('/api/add-level', { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(payload) });
                if (res.status === 401) { this.logout(); return; }
                if (res.ok) { this.successMessage = "Added!"; this.formData = { id: null, name: '', author: '', verifier: '', verification: '', percentToQualify: 100, password: 'free Copyable', records: [], creators: [], placement: null }; await this.refreshLevels(); } else { this.errorMessage = "Failed"; }
            } catch (e) { this.errorMessage = "Error"; } finally { this.isSubmitting = false; }
        },
        async deleteLevel(level) {
            if (!confirm(`Delete?`)) return;
            try {
                const res = await fetch('/api/delete-level', { 
                    method: 'POST', 
                    headers: this.getAuthHeaders(), 
                    body: JSON.stringify({ 
                        id: level._id
                    }) 
                });
                if (res.status === 401) { this.logout(); return; }
                await this.refreshLevels();
            } catch (e) { }
        },

        async openRulesModal() { 
            this.showRulesModal = true; 
            this.rulesMessage = '';
            this.rulesError = false;

            try {
                const res = await fetch(`/api/rules`);
                const data = await res.json();
                let fetchedRules = data.rules;

                if (!Array.isArray(fetchedRules)) {
                    const sections = [];
                    if (fetchedRules.level_rules && fetchedRules.level_rules.length) {
                        sections.push({
                            header: "Level Submission Rules",
                            visible: true,
                            text: fetchedRules.level_rules.join('\n')
                        });
                    }
                    if (fetchedRules.record_rules && fetchedRules.record_rules.length) {
                        sections.push({
                            header: "Record Submission Rules",
                            visible: true,
                            text: fetchedRules.record_rules.join('\n')
                        });
                    }
                    if (sections.length === 0) {
                        sections.push({ header: "New Rule Section", visible: true, text: "" });
                    }
                    this.rulesSections = sections;
                } else {
                    this.rulesSections = fetchedRules.map(s => ({
                        header: s.header,
                        visible: s.visible !== false,
                        text: Array.isArray(s.rules) ? s.rules.join('\n') : ""
                    }));
                }
            } catch (e) {
                console.error("Failed to load rules", e);
                this.rulesSections = [{ header: "Error Loading Rules", visible: true, text: "" }];
            }
        },
        
        closeRulesModal() { this.showRulesModal = false; },

        addRuleSection() {
            this.rulesSections.push({ header: "New Section", visible: true, text: "" });
        },

        removeRuleSection(index) {
            if (confirm("Delete this rule section?")) {
                this.rulesSections.splice(index, 1);
            }
        },

        getPreviewLines(text) {
            return text ? text.split('\n').filter(line => line.trim() !== '') : [];
        },

        renderMarkdown(text) {
            if (!text) return '';
            let content = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            let tag = 'p';
            let classes = 'type-body';
            let styles = 'margin:0;';

            if (content.startsWith('### ')) { tag = 'h5'; classes = 'type-title-md'; styles = 'margin-top: 10px; margin-bottom: 5px;'; content = content.substring(4); } 
            else if (content.startsWith('# ')) { tag = 'h3'; classes = 'type-headline-sm'; styles = 'margin-top: 15px; margin-bottom: 8px;'; content = content.substring(2); } 
            else if (content.startsWith('-# ')) { tag = 'p'; classes = 'type-label-sm'; styles = 'opacity: 0.7; margin-bottom: 5px;'; content = content.substring(3); }

            let isBullet = false;
            let isNested = false;

            if (content.match(/^\s{2,}\*\s/)) { isBullet = true; isNested = true; content = content.replace(/^\s{2,}\*\s/, ''); } 
            else if (content.startsWith('* ')) { isBullet = true; content = content.substring(2); }

            content = content.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 4px; border-radius:3px; font-family:monospace;">$1</code>');
            content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--color-primary); text-decoration:underline;">$1</a>');
            content = content.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            content = content.replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '<em>$1</em>');
            content = content.replace(/~~(.*?)~~/g, '<del>$1</del>');

            const textHTML = `<${tag} class="${classes}" style="${styles}">${content}</${tag}>`;

            if (isBullet) {
                const marginLeft = isNested ? '20px' : '0';
                return `<div style="display:flex; align-items:flex-start; margin-left:${marginLeft};"><span style="margin-right: 8px; color: var(--color-primary); font-weight: 700; line-height: 1.5;">•</span><div style="flex: 1;">${textHTML}</div></div>`;
            } else { return textHTML; }
        },

        async saveRules() {
            this.isSavingRules = true; this.rulesMessage = ''; this.rulesError = false;
            
            const payload = this.rulesSections.map(s => ({
                header: s.header,
                visible: s.visible,
                rules: s.text.split('\n').filter(line => line.trim() !== '')
            }));

            try {
                const res = await fetch('/api/rules', { 
                    method: 'POST', 
                    headers: this.getAuthHeaders(), 
                    body: JSON.stringify({ 
                        rules: payload
                    }) 
                });
                if (res.status === 401) { this.logout(); return; }
                if (res.ok) { this.rulesMessage = "Rules Updated Successfully!"; } else { this.rulesMessage = "Failed to save rules."; this.rulesError = true; }
            } catch (e) { this.rulesMessage = "Error connecting to server."; this.rulesError = true; } finally { this.isSavingRules = false; }
        },

        openEditRecordsModal(level) { this.editingRecordsLevel = level; this.editingLevel = JSON.parse(JSON.stringify(level)); if (!this.editingLevel.records) this.editingLevel.records = []; },
        closeEditRecordsModal() { this.editingRecordsLevel = null; this.editRecordsMessage = ''; this.editRecordsError = false; },
        addEditingRecord() { this.editingLevel.records.push({ user: '', link: '', percent: 100, hz: 60 }); },

        async saveEditLevel() {
            this.isSavingRecords = true;
            this.editRecordsMessage = '';
            this.editRecordsError = false;
            let newLevelData = { ...this.editingLevel };
            delete newLevelData._id; delete newLevelData.rank;
            const authors = newLevelData.author.split(',').map(a => a.trim()).filter(a => a);
            if (authors.length > 1) { newLevelData.creators = authors; newLevelData.author = authors[0]; } else { delete newLevelData.creators; }

            try {
                const res = await fetch('/api/update-records', { method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify({ oldLevelId: this.editingRecordsLevel._id, newLevelData: newLevelData }) });
                if (res.status === 401) { this.logout(); return; }
                const data = await res.json();
                if (res.ok) { 
                    this.editRecordsMessage = data.message || '✓ Level updated successfully';
                    this.editRecordsError = false;
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    await this.refreshLevels(); 
                    this.closeEditRecordsModal(); 
                } else {
                    this.editRecordsMessage = data.error || 'Failed to update level';
                    this.editRecordsError = true;
                }
            } catch (e) { 
                this.editRecordsMessage = e.message || 'An error occurred';
                this.editRecordsError = true;
            } finally { 
                this.isSavingRecords = false; 
            }
        }
    }
};
// dashboard.js - Updated for stability and reliability

document.addEventListener('DOMContentLoaded', () => {
    loadLatestMeeting();
    loadTasks();
});

// Explicitly bind to window to ensure HTML onclick can find it
window.deleteTask = function (taskId) {
    if (!confirm("Are you sure you want to delete this task?")) return;

    // UI feedback immediately
    const btn = document.querySelector(`button[onclick="deleteTask(${taskId})"]`);
    if (btn) btn.innerText = "⏳";

    fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                loadTasks(); // Reload list
            } else {
                alert("Failed to delete task.");
                if (btn) btn.innerText = "❌";
            }
        })
        .catch(err => {
            console.error("Delete error:", err);
            alert("Error deleting task.");
            if (btn) btn.innerText = "❌";
        });
};

function loadLatestMeeting() {
    fetch('/api/meeting/latest')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('mom-content');
            if (data.error || !data.date) {
                container.innerHTML = `<p class="text-muted">No meetings recorded yet.</p>`;
                return;
            }

            let actionsHtml = '';
            if (data.key_points && Array.isArray(data.key_points) && data.key_points.length > 0) {
                actionsHtml += `<h5>Key Points</h5><ul>${data.key_points.map(k => `<li>${k}</li>`).join('')}</ul>`;
            }

            // Safety checks for new code
            const summary = data.summary || "No summary available.";
            const lang = data.language_detected || "Unknown";

            container.innerHTML = `
            <h4>${data.date}</h4>
            <p><strong>Summary:</strong> ${summary}</p>
            ${actionsHtml}
            <div style="margin-top:10px; font-size:0.9rem; color:#555;">
                <strong>Original Lang:</strong> ${lang}
            </div>
        `;
        })
        .catch(err => {
            console.error("Error loading meeting:", err);
            document.getElementById('mom-content').innerHTML = "<p>Error loading data.</p>";
        });
}

function loadTasks() {
    fetch('/api/tasks')
        .then(res => res.json())
        .then(tasks => {
            const list = document.getElementById('task-list');
            list.innerHTML = '';

            if (!tasks || tasks.length === 0) {
                list.innerHTML = `<li class="task-item" style="justify-content:center;">No tasks found. Start a meeting to assign tasks!</li>`;
                updateInsights(0, 0);
                renderChart(0, 0, 0);
                return;
            }

            // Analytics Data Pre-calc
            let highRisk = 0, mediumRisk = 0, lowRisk = 0;

            tasks.forEach(task => {
                // normalize fields
                const risk = task.risk_level || "Low";
                const priority = task.priority || "Medium";

                // Count for chart
                if (risk === 'High') highRisk++;
                else if (risk === 'Medium') mediumRisk++;
                else lowRisk++;

                const li = document.createElement('li');
                li.className = 'task-item';

                let badgeClass = 'badge-low';
                if (priority === 'High') badgeClass = 'badge-high';
                else if (priority === 'Medium') badgeClass = 'badge-medium';

                li.innerHTML = `
                <div style="flex-grow:1;">
                    <div style="font-weight:600; font-size:1.05rem;">${task.title}</div>
                    <div class="task-meta" style="color:#6b7280; font-size:0.9rem; margin-top:4px;">
                        👤 <strong>${task.assignee || 'Unassigned'}</strong> &nbsp;|&nbsp; 📅 ${task.deadline || 'No Deadline'}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="text-align:right;">
                        <span class="badge ${badgeClass}">${priority}</span>
                        ${risk === 'High' ? '<div style="font-size:0.75rem; color:#ef4444; font-weight:700;">⚠️ Risk</div>' : ''}
                    </div>
                    <button onclick="deleteTask(${task.id})" class="delete-btn" title="Delete Task" style="background:none; border:none; font-size:1.2rem; cursor:pointer; opacity:0.7; transition:opacity 0.2s;">
                        ❌
                    </button>
                </div>
            `;
                list.appendChild(li);
            });

            renderChart(highRisk, mediumRisk, lowRisk);
            updateInsights(highRisk, tasks.length);
        })
        .catch(err => console.error("Load tasks error:", err));
}

let riskChartInstance = null;

function renderChart(high, medium, low) {
    const ctx = document.getElementById('riskChart').getContext('2d');

    if (riskChartInstance) {
        riskChartInstance.destroy();
    }

    riskChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['High Risk', 'Medium Risk', 'Low Risk'],
            datasets: [{
                data: [high, medium, low],
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateInsights(highRiskCount, totalTasks) {
    const container = document.getElementById('priority-insight');
    if (highRiskCount > 0) {
        container.innerHTML = `
            <p style="color: #b91c1c; font-weight:600;">⚠️ Attention Required</p>
            <p>You have ${highRiskCount} high-risk tasks pending. Focus on clearing "High Priority" items first to reduce project slippage.</p>
        `;
    } else if (totalTasks > 0) {
        container.innerHTML = `
            <p style="color: #047857; font-weight:600;">✅ On Track</p>
            <p>Workload is balanced. No critical bottlenecks detected.</p>
        `;
    } else {
        container.innerHTML = `<p class="text-muted">No tasks to analyze.</p>`;
    }
}

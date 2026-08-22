const Task         = require('../models/Task');
const User         = require('../models/User');
const Farm         = require('../models/Farm');
const Notification = require('../models/Notification');
const AuditLog     = require('../models/AuditLog');

/* ══════════════════════════════════════════════════════════════════════════
   HIERARCHY
   owner          → office_manager, farmer
   office_manager → farmer, labor
   farmer         → labor  (same farm only)
   labor          → nobody
══════════════════════════════════════════════════════════════════════════ */

const ASSIGN_MAP = {
  owner:          ['office_manager', 'farmer'],
  office_manager: ['farmer', 'labor'],
  farmer:         ['labor'],
  labor:          [],
  admin:          [],
};

const getRole = (u) => u?.assignedRole || u?.role || '';

/* ── Audit helper (never crashes the main request) ─────────────────────── */
const audit = async (userId, action, resourceId, details, ip) => {
  try {
    await AuditLog.create({
      userId, action,
      resource:   'Task',
      resourceId,
      metadata:   { details },
      ipAddress:  ip || '',
    });
  } catch { /* ignore audit failures */ }
};

/* ── Populate helper ────────────────────────────────────────────────────── */
const populate = (q) =>
  q.populate('assignedTo', 'name email assignedRole farmId')
   .populate('created_by',  'name email assignedRole')
   .populate('completedBy', 'name email')
   .populate('farmId',      'name location');

/* ── Check whether `creator` can assign to `targetRole` ────────────────── */
const canAssignToRole = (creatorRole, targetRole) =>
  (ASSIGN_MAP[creatorRole] || []).includes(targetRole);

/* ── Farm-scope check: can `user` act on `farmId`? ──────────────────────── */
const hasFarmAccess = async (user, farmId) => {
  if (!farmId) return true;          // no farm restriction
  const role = getRole(user);
  if (role === 'owner' || role === 'office_manager' || role === 'admin') return true;
  
  const freshUser = await User.findById(user._id).select('farmId assignedFarms');
  const farmerFarmId = (freshUser?.farmId || user.farmId)?.toString();
  const assignedFarms = (freshUser?.assignedFarms || user.assignedFarms || []).map(id => id.toString());
  
  return farmerFarmId === farmId.toString() || assignedFarms.includes(farmId.toString());
};

/* ── Friendly permission error ──────────────────────────────────────────── */
const permDenied = (res) =>
  res.status(403).json({ error: "You don't have permission to perform this action." });

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/tasks/assignable-users
   Returns users the current user can assign tasks to,
   optionally filtered by farmId (for farmer: only their farm's laborers).
══════════════════════════════════════════════════════════════════════════ */
const getAssignableUsers = async (req, res) => {
  try {
    const role     = getRole(req.user);
    const { farmId } = req.query;
    const allowedRoles = ASSIGN_MAP[role] || [];

    if (!allowedRoles.length) return res.json([]);

    const query = {
      assignedRole:  { $in: allowedRoles },
      accountStatus: 'active',
    };

    // Farmer can only assign to labor on their own farm
    if (role === 'farmer') {
      const freshUser = await User.findById(req.user._id).select('farmId assignedFarms');
      const farmerFarmId = freshUser?.farmId || req.user.farmId;
      const assignedFarms = freshUser?.assignedFarms || req.user.assignedFarms || [];
      const farmIds = [];
      if (farmerFarmId) farmIds.push(farmerFarmId);
      if (Array.isArray(assignedFarms)) {
        assignedFarms.forEach(id => {
          if (id && !farmIds.some(existing => existing.toString() === id.toString())) {
            farmIds.push(id);
          }
        });
      }

      if (!farmIds.length) return res.json([]);   // farmer has no farm yet
      query.$or = [
        { farmId: { $in: farmIds } },
        { assignedFarms: { $in: farmIds } }
      ];
    }

    // If farmId filter given, further scope to that farm's workers
    if (farmId && role !== 'owner' && role !== 'office_manager') {
      query.farmId = farmId;
    }

    const users = await User.find(query).select('name email assignedRole farmId');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assignable users', details: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/tasks/stats
══════════════════════════════════════════════════════════════════════════ */
  const getTaskStats = async (req, res) => {
    try {
      const role  = getRole(req.user);
      let query = {};
      
      if (role !== 'owner') {
        const freshUser = await User.findById(req.user._id).select('farmId assignedFarms');
        const farmIds = [freshUser?.farmId, ...(freshUser?.assignedFarms || [])].filter(Boolean).map(id => id.toString());
        
        if (role === 'farmer') {
          query.$or = [
            { assignedTo: req.user._id },
            { created_by: req.user._id },
            { farmId: { $in: farmIds } }
          ];
        } else if (role === 'office_manager') {
          query.$or = [
            { assignedTo: req.user._id },
            { created_by: req.user._id }
          ];
        } else {
          query.assignedTo = req.user._id;
        }
      }

      const [total, pending, inProgress, completed, cancelled, overdue] = await Promise.all([
      Task.countDocuments(query),
      Task.countDocuments({ ...query, status: 'pending'     }),
      Task.countDocuments({ ...query, status: 'in_progress' }),
      Task.countDocuments({ ...query, status: 'completed'   }),
      Task.countDocuments({ ...query, status: 'cancelled'   }),
      Task.countDocuments({ ...query, status: { $in: ['pending','in_progress'] }, deadline: { $lt: new Date() } }),
    ]);

    res.json({ total, pending, inProgress, completed, cancelled, overdue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task stats', details: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/tasks
══════════════════════════════════════════════════════════════════════════ */
const getTasks = async (req, res) => {
  try {
    const role = getRole(req.user);
    const { status, farmId, assignedTo, priority, createdBy } = req.query;

    let query = {};

    /* role-based scope ──────────────────────────────────────────────────── */
    if (role === 'owner') {
      // owner sees all
    } else if (role === 'office_manager') {
      // OM sees tasks they created OR tasks assigned to them
      query.$or = [
        { created_by: req.user._id },
        { assignedTo: req.user._id },
      ];
    } else if (role === 'farmer') {
      const freshUser = await User.findById(req.user._id).select('farmId assignedFarms');
      const farmerFarms = [freshUser?.farmId, ...(freshUser?.assignedFarms || [])].filter(Boolean).map(id => id.toString());
      query.$or = [
        { assignedTo:  req.user._id },
        { created_by:  req.user._id },
        { farmId: { $in: farmerFarms } },
      ];
    } else {
      // labor and admin: only their own assigned tasks
      query.assignedTo = req.user._id;
    }

    /* optional filters ─────────────────────────────────────────────────── */
    if (status)     query.status   = status;
    if (farmId)     query.farmId   = farmId;
    if (priority)   query.priority = priority;
    if (assignedTo) {
      if (role === 'owner' || role === 'office_manager') {
        if (query.$or) delete query.$or;
        query.assignedTo = assignedTo;
      }
    }
    if (createdBy && role === 'owner') {
      query.created_by = createdBy;
    }

    const tasks = await populate(Task.find(query).sort({ createdAt: -1 }));
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/tasks/:id
══════════════════════════════════════════════════════════════════════════ */
const getTaskById = async (req, res) => {
  try {
    const task = await populate(Task.findById(req.params.id));
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const role   = getRole(req.user);
    const uid    = req.user._id.toString();
    const isOwner = role === 'owner';
    const created  = task.created_by?._id?.toString() === uid;
    const assigned = task.assignedTo?._id?.toString() === uid;

    if (!isOwner && !created && !assigned) return permDenied(res);

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task', details: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/tasks  — create & assign
══════════════════════════════════════════════════════════════════════════ */
const createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, farmId, priority, deadline, notes } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'Task title is required' });
    if (!assignedTo)    return res.status(400).json({ error: 'Assigned user is required' });

    const creatorRole = getRole(req.user);

    /* ── target user checks ────────────────────────────────────────────── */
    const targetUser = await User.findById(assignedTo).select('name email assignedRole farmId assignedFarms accountStatus');
    if (!targetUser || targetUser.accountStatus !== 'active') {
      return res.status(404).json({ error: 'User not found or inactive' });
    }

    const targetRole = getRole(targetUser);

    /* hierarchy check */
    if (!canAssignToRole(creatorRole, targetRole)) {
      await audit(req.user._id, 'UNAUTHORIZED_TASK_ASSIGN', null,
        `${creatorRole} tried to assign to ${targetRole} — denied`, req.ip);
      return permDenied(res);
    }

    /* farm-scope check */
    if (farmId && !(await hasFarmAccess(req.user, farmId))) {
      return permDenied(res);
    }

    // Farmer can only assign labor from their own farm
    if (creatorRole === 'farmer' && targetRole === 'labor') {
      const freshFarmer = await User.findById(req.user._id).select('farmId assignedFarms');
      const farmerFarmIds = [freshFarmer?.farmId, ...(freshFarmer?.assignedFarms || [])].filter(Boolean).map(id => id.toString());
      const laborFarmIds = [targetUser?.farmId, ...(targetUser?.assignedFarms || [])].filter(Boolean).map(id => id.toString());
      
      const sharesFarm = farmerFarmIds.some(fid => laborFarmIds.includes(fid));
      if (!sharesFarm) {
        return permDenied(res);
      }
    }

    const resolvedFarmId = farmId || targetUser.farmId || (creatorRole === 'farmer' ? req.user.farmId : null) || null;

    const task = await Task.create({
      title:       title.trim(),
      description: description?.trim() || '',
      assignedTo,
      farmId:      resolvedFarmId,
      created_by:  req.user._id,
      priority:    priority || 'medium',
      deadline:    deadline ? new Date(deadline) : null,
      notes:       notes || '',
    });

    const formatted = await populate(Task.findById(task._id));

    /* In-app notification */
    try {
      await Notification.create({
        userId: targetUser._id,
        farmId: resolvedFarmId || undefined,
        type: task.priority === 'urgent' ? 'warning' : 'info',
        message: `New task assigned: "${task.title}" by ${req.user.name}`,
        sourceRef: { kind: 'Task', item: task._id },
        timestamp: new Date(),
      });
    } catch (notifErr) {
      console.warn('[Task] In-app notification creation error:', notifErr.message);
    }

    /* Email notification */
    try {
      const notifSvc = require('../services/notificationService');
      if (targetUser.email) {
        await notifSvc.sendAlertEmail(
          targetUser.email,
          `🌱 New Task Assigned: "${task.title}"`,
          `Hello <strong>${targetUser.name}</strong>,<br><br>
           You have been assigned a new task by <strong>${req.user.name}</strong>:<br><br>
           <strong>${task.title}</strong><br>
           ${task.description ? `<em>${task.description}</em><br><br>` : ''}
           ${formatted.farmId ? `Farm: <strong>${formatted.farmId.name}</strong><br>` : ''}
           Priority: <strong>${task.priority.toUpperCase()}</strong><br>
           ${task.deadline ? `Due Date: <strong>${new Date(task.deadline).toLocaleDateString()}</strong>` : ''}`
        );
      }
    } catch { /* ignore notification failure */ }

    await audit(req.user._id, 'TASK_CREATED', task._id,
      `Assigned "${task.title}" to ${targetUser.name} (${targetRole})`, req.ip);

    res.status(201).json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   PUT /api/tasks/:id  — update fields & reassign (creator or owner)
══════════════════════════════════════════════════════════════════════════ */
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const role    = getRole(req.user);
    const uid     = req.user._id.toString();
    const creator = task.created_by?.toString();
    const assignee= task.assignedTo?.toString();

    // Only the creator or the owner can update/reassign task
    if (role !== 'owner' && creator !== uid) return permDenied(res);

    const allowed = ['title', 'description', 'priority', 'deadline', 'notes', 'farmId'];
    allowed.forEach(f => { if (req.body[f] !== undefined) task[f] = req.body[f]; });

    // Reassignment check
    if (req.body.assignedTo && req.body.assignedTo !== assignee) {
      const newUser = await User.findById(req.body.assignedTo).select('name email assignedRole farmId assignedFarms accountStatus');
      if (!newUser || newUser.accountStatus !== 'active') return res.status(404).json({ error: 'User not found or inactive' });
      
      const newTargetRole = getRole(newUser);
      if (!canAssignToRole(role === 'owner' ? 'owner' : role, newTargetRole)) {
        return permDenied(res);
      }

      // Check farmer farm scope
      if (role === 'farmer' && newTargetRole === 'labor') {
        const freshFarmer = await User.findById(req.user._id).select('farmId assignedFarms');
        const farmerFarmIds = [freshFarmer?.farmId, ...(freshFarmer?.assignedFarms || [])].filter(Boolean).map(id => id.toString());
        const laborFarmIds = [newUser?.farmId, ...(newUser?.assignedFarms || [])].filter(Boolean).map(id => id.toString());
        if (!farmerFarmIds.some(fid => laborFarmIds.includes(fid))) {
          return permDenied(res);
        }
      }

      task.assignedTo = req.body.assignedTo;

      // In-app notification for newly assigned user
      try {
        await Notification.create({
          userId: newUser._id,
          farmId: task.farmId || undefined,
          type: task.priority === 'urgent' ? 'warning' : 'info',
          message: `Task reassigned to you: "${task.title}" by ${req.user.name}`,
          sourceRef: { kind: 'Task', item: task._id },
          timestamp: new Date(),
        });
      } catch { /* ignore */ }

      // Email notification
      try {
        const notifSvc = require('../services/notificationService');
        if (newUser.email) {
          await notifSvc.sendAlertEmail(
            newUser.email,
            `🌱 Task Reassigned to You: "${task.title}"`,
            `Hello <strong>${newUser.name}</strong>,<br><br>
             The task <strong>"${task.title}"</strong> has been reassigned to you by <strong>${req.user.name}</strong>.<br><br>
             Priority: <strong>${task.priority.toUpperCase()}</strong><br>
             ${task.deadline ? `Due Date: <strong>${new Date(task.deadline).toLocaleDateString()}</strong>` : ''}`
          );
        }
      } catch { /* ignore */ }

      await audit(req.user._id, 'TASK_REASSIGNED', task._id,
        `Reassigned task "${task.title}" to ${newUser.name} (${newTargetRole})`, req.ip);
    }

    await task.save();
    const formatted = await populate(Task.findById(task._id));

    await audit(req.user._id, 'TASK_UPDATED', task._id, `Updated task "${task.title}"`, req.ip);
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task', details: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   PATCH /api/tasks/:id/status  — assignee, creator, or owner changes status
══════════════════════════════════════════════════════════════════════════ */
const updateStatus = async (req, res) => {
  try {
    const { status, completionNotes } = req.body;
    const valid = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}` });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const role    = getRole(req.user);
    const uid     = req.user._id.toString();
    const assignee= task.assignedTo?.toString();
    const creator = task.created_by?.toString();

    // Owner can change any status; assignee and creator can change status on their tasks
    const canChange = role === 'owner'
      || assignee === uid
      || creator  === uid;

    if (!canChange) return permDenied(res);

    const prev = task.status;
    task.status = status;

    if (status === 'in_progress' && prev === 'pending') {
      task.startedAt = new Date();
      task.progress  = 50;
    } else if (status === 'completed') {
      task.completedAt     = new Date();
      task.completedBy     = req.user._id;
      task.completionNotes = completionNotes || '';
      task.progress        = 100;

      /* Notify creator when task completed */
      try {
        const creator_doc = await User.findById(task.created_by).select('name email');
        const assignee_doc = await User.findById(task.assignedTo).select('name');
        
        // In-app notification for creator
        await Notification.create({
          userId: task.created_by,
          farmId: task.farmId || undefined,
          type: 'success',
          message: `Task completed: "${task.title}" by ${assignee_doc?.name || req.user.name}`,
          sourceRef: { kind: 'Task', item: task._id },
          timestamp: new Date(),
        });

        // Email alert
        const notifSvc = require('../services/notificationService');
        if (creator_doc?.email) {
          await notifSvc.sendAlertEmail(
            creator_doc.email,
            `✅ Task Completed: "${task.title}"`,
            `<strong>${assignee_doc?.name || 'A team member'}</strong> has completed the task
             <strong>"${task.title}"</strong>.<br><br>
             ${completionNotes ? `Completion notes: <em>${completionNotes}</em><br>` : ''}
             Completed on: <strong>${new Date().toLocaleString()}</strong>`
          );
        }
      } catch { /* ignore notification failure */ }

    } else if (status === 'pending') {
      task.startedAt    = null;
      task.completedAt  = null;
      task.completedBy  = null;
      task.progress     = 0;
    } else if (status === 'cancelled') {
      task.progress = 0;
    }

    await task.save();
    const formatted = await populate(Task.findById(task._id));

    await audit(req.user._id, `TASK_${status.toUpperCase()}`, task._id,
      `Status changed ${prev} → ${status}`, req.ip);

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status', details: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   DELETE /api/tasks/:id
   Creator or owner can delete (only if pending or cancelled)
══════════════════════════════════════════════════════════════════════════ */
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const role    = getRole(req.user);
    const uid     = req.user._id.toString();
    const creator = task.created_by?.toString();

    if (role !== 'owner' && creator !== uid) return permDenied(res);

    if (!['pending', 'cancelled'].includes(task.status) && role !== 'owner') {
      return res.status(400).json({ error: 'Can only delete pending or cancelled tasks' });
    }

    await Task.findByIdAndDelete(req.params.id);
    await audit(req.user._id, 'TASK_DELETED', req.params.id,
      `Deleted task "${task.title}"`, req.ip);

    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task', details: err.message });
  }
};

module.exports = {
  getAssignableUsers,
  getTaskStats,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateStatus,
  deleteTask,
};

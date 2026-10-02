'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, Loader2, UserPlus, X } from 'lucide-react';

const EMPTY = { full_name: '', national_id: '' };
const FIELDS = [
  { name: 'full_name', label: 'الاسم بالكامل', placeholder: 'مثال: أحمد محمد علي', minLength: 3, autoComplete: 'name' },
  { name: 'national_id', label: 'الرقم القومي', placeholder: '14 رقم', inputMode: 'numeric', maxLength: 14 },
];

function validate(values) {
  const errors = {};
  if (values.full_name.trim().length < 3) errors.full_name = 'الاسم لازم يكون 3 حروف على الأقل';
  if (!/^[0-9]{14}$/.test(values.national_id)) errors.national_id = 'لازم يكون 14 رقم';
  return errors;
}

export default function EmployeeForm({ employee, onClose, onSaved }) {
  const isEdit = Boolean(employee);
  const [values, setValues] = useState(EMPTY);  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);
  const objectUrl = useRef(null);

  useEffect(() => {
    if (employee) {
      setValues({
        full_name: employee.full_name ?? '',
        national_id: employee.national_id ?? '',
      });
    }
    return () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); };
  }, [employee]);

  function update(name, value) {
    const next = name === 'national_id' ? value.replace(/[^\d]/g, '') : value;
    setValues((prev) => ({ ...prev, [name]: next }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  async function pickAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setAvatarError('الصورة لازم تكون JPG أو PNG أو WEBP');
    if (file.size > 4 * 1024 * 1024) return setAvatarError('حجم الصورة أكبر من 4 ميجا');
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setAvatarPreview(objectUrl.current);

    if (!employee) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('employeeId', employee.id);
    try {
      const response = await fetch(`/api/employees/${employee.id}/avatar`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'رفع الصورة فشل');
      onSaved?.({ type: 'avatar', employee: { ...employee, avatar_url: payload.storagePath }, avatarUrl: payload.avatarUrl });
    } catch (error) {
      setAvatarError(error.message);
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const response = await fetch(isEdit ? `/api/employees/${employee.id}` : '/api/employees', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'حفظ البيانات فشل');
      onSaved?.({ type: isEdit ? 'updated' : 'created', employee: payload.employee });
      onClose();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  }

  const currentAvatar = avatarPreview ?? employee?.avatarUrl ?? null;
  const initials = values.full_name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');

  return (
    <motion.div className="modal-backdrop modal-backdrop--center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .22 }} onClick={onClose}>
      <motion.div
        className="emp-modal glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emp-form-title"
        initial={{ opacity: 0, scale: .92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: .95 }}
        transition={{ duration: .26, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="emp-modal-head">
          <div>
            <span className="section-kicker">{isEdit ? 'تعديل بيانات' : 'موظف جديد'}</span>
            <h2 id="emp-form-title">{isEdit ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h2>
          </div>
          <button type="button" className="emp-close" onClick={onClose} aria-label="إغلاق"><X size={19} /></button>
        </header>

        <form onSubmit={submit} className="emp-form">
          <div className="avatar-editor">
            <div className="avatar-circle" aria-hidden="true">
              {currentAvatar
                ? <img src={currentAvatar} alt="" />
                : initials
                  ? <span className="avatar-initials">{initials}</span>
                  : <span className="avatar-blank" />}
              {uploading && <span className="avatar-overlay"><Loader2 size={19} className="spin" /></span>}
            </div>
            <div className="avatar-actions">
              <button type="button" className="avatar-button" onClick={() => fileInput.current?.click()} disabled={uploading}>
                <Camera size={17} /> {uploading ? 'جاري الرفع...' : isEdit ? 'تغيير الصورة' : 'رفع صورة'}
              </button>
              {avatarError && <span className="avatar-error">{avatarError}</span>}
              {!isEdit && <span className="avatar-hint">تقدر ترفع الصورة بعد الحفظ</span>}
            </div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickAvatar} className="sr-only" />
          </div>

          <div className="emp-grid">
            {FIELDS.map((field) => (
              <div key={field.name} className="emp-field">
                <label htmlFor={`emp-${field.name}`}>{field.label}</label>
                <div className={`emp-input ${errors[field.name] ? 'has-error' : ''}`}>
                  <input
                    id={`emp-${field.name}`}
                    inputMode={field.inputMode}
                    maxLength={field.maxLength}
                    autoComplete={field.autoComplete}
                    dir={field.dir}
                    placeholder={field.placeholder}
                    value={values[field.name]}
                    onChange={(event) => update(field.name, event.target.value)}
                    aria-invalid={Boolean(errors[field.name])}
                  />
                </div>
                {errors[field.name] && <span className="emp-error">{errors[field.name]}</span>}
              </div>
            ))}
          </div>

          {formError && <p className="emp-form-error" role="alert">{formError}</p>}

          <div className="emp-form-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>إلغاء</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? <><Loader2 size={17} className="spin" /> جاري الحفظ...</> : isEdit ? <><Check size={17} /> حفظ التعديلات</> : <><UserPlus size={17} /> إضافة الموظف</>}
            </button>
          </div>
        </form>
        <AnimatePresence>{saving && <motion.span className="sr-only" aria-live="polite">جارٍ الحفظ</motion.span>}</AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

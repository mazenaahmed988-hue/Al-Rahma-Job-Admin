'use client';

import { motion } from 'framer-motion';

/**
 * كارت إحصائية زجاجي مشترك — نفس الشكل المستخدم في كل الأقسام.
 */
export default function StatCard({ icon: Icon, label, value, delay = 0 }) {
  return (
    <motion.div
      className="stat-card glass"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <span className="stat-icon">
        <Icon size={19} />
      </span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </motion.div>
  );
}
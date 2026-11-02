import mongoose from 'mongoose';
import { fallbackSiteModel } from './memoryStore.js';

const SiteSchema = new mongoose.Schema(
  {
    searchId: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'Search',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    auditStatus: {
      type: String,
      enum: ['pending', 'running', 'done', 'failed'],
      default: 'pending',
      index: true,
    },
    audit: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    brokenCertainCount: {
      type: Number,
      default: 0,
    },
    brokenTotalCount: {
      type: Number,
      default: 0,
    },
    sslIssueCount: {
      type: Number,
      default: 0,
    },
    auditedAt: {
      type: Date,
      default: null,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

SiteSchema.index({ url: 1, auditedAt: -1 });
SiteSchema.index({ searchId: 1, auditStatus: 1 });

export const MongooseSite = mongoose.models.Site || mongoose.model('Site', SiteSchema);

export const Site = new Proxy(MongooseSite, {
  get(target, prop, receiver) {
    if (mongoose.connection.readyState !== 1 && prop in fallbackSiteModel) {
      return fallbackSiteModel[prop];
    }
    const val = Reflect.get(target, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
  },
  set(target, prop, value) {
    fallbackSiteModel[prop] = value;
    return Reflect.set(target, prop, value);
  },
});

export default Site;

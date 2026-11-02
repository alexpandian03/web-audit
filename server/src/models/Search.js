import mongoose from 'mongoose';
import { fallbackSearchModel } from './memoryStore.js';

const SearchSchema = new mongoose.Schema(
  {
    keyword: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedKeyword: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['places', 'serpapi'],
      default: 'places',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

SearchSchema.index({ normalizedKeyword: 1, createdAt: -1 });
SearchSchema.index({ createdAt: -1 });

export const MongooseSearch = mongoose.models.Search || mongoose.model('Search', SearchSchema);

export const Search = new Proxy(MongooseSearch, {
  get(target, prop, receiver) {
    if (mongoose.connection.readyState !== 1 && prop in fallbackSearchModel) {
      return fallbackSearchModel[prop];
    }
    const val = Reflect.get(target, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
  },
  set(target, prop, value) {
    fallbackSearchModel[prop] = value;
    return Reflect.set(target, prop, value);
  },
});

export default Search;

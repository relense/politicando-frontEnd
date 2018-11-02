import { combineReducers } from 'redux';
import parties from './partiesReducer';
import view from './viewsReducer';
import articles from './articlesReducer';

const rootReducer = combineReducers({
  parties,
  view,
  articles
});

export default rootReducer;

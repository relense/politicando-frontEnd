import { combineReducers } from 'redux';
import parties from './partiesReducer';
import view from './viewsReducer';
import articles from './articlesReducer';
import article from './articleReducer';

const rootReducer = combineReducers({
  parties,
  view,
  articles,
  article
});

export default rootReducer;

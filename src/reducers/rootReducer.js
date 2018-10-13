import { combineReducers } from 'redux';
import parties from './partiesReducer';
import view from './viewsReducer';

const rootReducer = combineReducers({
  parties,
  view
});

export default rootReducer;

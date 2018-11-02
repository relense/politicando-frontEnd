import { FETCH_ARTICLES } from '../actions/actionTypes';

const initialState = {
    all_articles: [],
}

export default function articles(state = initialState, action) {
  switch (action.type) {
    case FETCH_ARTICLES:
      return action;

    default:
      return state;
  }
}

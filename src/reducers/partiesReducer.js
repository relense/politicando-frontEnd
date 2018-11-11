import { FETCH_PARTIES, RECEIVE_PARTIES, CHANGE_CURRENT_PARTIE, FETCH_PARTIE_ARTICLES } from '../actions/actionTypes';

const initialState = {
    partieList: [],
    currentPartie: "",
    partieNews: null
}

export default function parties(state = initialState, action) {
  switch (action.type) {
    case FETCH_PARTIES:
      return action;

    case RECEIVE_PARTIES:
      return {
        ...state,
        partieList: action.parties
      }

    case CHANGE_CURRENT_PARTIE:
      return {
        ...state,
        currentPartie: action.partie
      }
    case FETCH_PARTIE_ARTICLES:
      return {
        ...state,
        partieNews: action.news
      }

    default:
      return state;
  }
}

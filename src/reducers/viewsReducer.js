import { SET_VIEW, SET_PARTY_VIEW, OPEN_DRAWER, CLOSE_DRAWER, DARK_MODE } from '../actions/actionTypes';

const initialState = {
    currentView: "HOME",
    partyView: "NOTICIAS",
    drawer: false,
    darkMode: false
}

export default function view(state = initialState, action) {
  switch (action.type) {
    case SET_VIEW:
      return {
        ...state,
        currentView: action.view
      }
    
    case SET_PARTY_VIEW:
      return {
        ...state,
        partyView: action.partyView
      }

    case CLOSE_DRAWER:
      return {
        ...state,
        drawer: false
      }
    
    case OPEN_DRAWER:
      return {
        ...state,
        drawer: true
      }
    
      case DARK_MODE:
        return {
          ...state,
          darkMode: !state.darkMode
        }

    default:
      return state;
  }
}

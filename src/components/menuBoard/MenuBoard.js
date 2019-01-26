import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from "react-router-dom";
import './MenuBoard.css';
import { asyncChangeView, asyncChangePartyView, asyncCloseDrawer } from '../../redux/actions/viewActions';
import { asyncChangeCurrentPartie, asyncGetPartieNews } from '../../redux/actions/partiesActions';
import { checkDarkMode, checkDarkModeBackground } from '../../utils/CheckDarkMode.js';

const PARTIES = 'PARTIES';

class MenuBoard extends Component {
  constructor(props) {
    super(props)
    this.state = {
      opened: true
    }
  }

  elemFuncs = (currentElem, i = -1) => {
    if(i !== -1) {
      this.props.changeView("PARTIES");
      this.props.changeCurrentPartie(this.props.parties[i]);
      this.props.getPartieNews(this.props.parties[i].id);
      window.scrollTo(0, 0);
      this.props.setPartyView("NOTICIAS"); 
    } else {
      if(currentElem === PARTIES) {
        this.props.changeView(currentElem);
        return;
      }
        window.scrollTo(0, 0);
        this.props.changeView(currentElem);
        this.props.changeCurrentPartie("");
    }
    this.props.closeDrawer();
  }

  renderMainRow = () => {
    let data = [];
    data.push(this.renderPartieRow())
    return data;
  }

  renderPartieRow = () => {
    let data = [];

    if (this.props.parties.length !== 0) {
      for(let i = 0; i < this.props.parties.length; i++) {
        if(this.props.currentPartie.party_name === this.props.parties[i].party_name) {
          data.push(
              <Link to="/" key={i} className="menuBoardNavlink"><div className={'menuBoardnavElems noSelect' + checkDarkMode(this.props.darkMode, true)} onClick={() => this.elemFuncs(this.props.parties[i], i)}>
                  { this.props.parties[i].party_name} : {this.props.parties[i].description }
              </div></Link>
          );
        } else {
          data.push(
              <Link to="/" key={i} className="menuBoardNavlink"><div className={'menuBoardnavElems noSelect' + checkDarkMode(this.props.darkMode, true)} onClick={() => this.elemFuncs(this.props.parties[i], i)}>
                 { this.props.parties[i].party_name} : { this.props.parties[i].description }
              </div></Link>
          );
        }
      }
    }
    return data;
  }

  render() {
    return (
      <div className={(this.props.scroll ? 'menuBoardContainer menuBoardSticky' : 'menuBoardContainer') + checkDarkModeBackground(this.props.darkMode)}>
        {this.renderMainRow()}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    current: state.view.currentView,
    parties: state.parties.partieList,
    currentPartie: state.parties.currentPartie,
    partyView: state.view.partyView,
    darkMode: state.view.darkMode
  };
}

function mapDispatchToProps(dispatch) {
  return {
    changeView: (view) => {
      dispatch(asyncChangeView(view))
    },
    changeCurrentPartie: (partie) => {
      dispatch(asyncChangeCurrentPartie(partie))
    },
    getPartieNews: (partie_id) => {
      dispatch(asyncGetPartieNews(partie_id))
    },
    setPartyView: (view) => {
      dispatch(asyncChangePartyView(view))
    },
    closeDrawer: () => {
      dispatch(asyncCloseDrawer())
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(MenuBoard);

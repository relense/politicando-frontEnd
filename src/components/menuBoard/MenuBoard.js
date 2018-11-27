import React, { Component } from 'react';
import { connect } from 'react-redux';
import './MenuBoard.css';
import { asyncChangeView, asyncChangePartyView, asyncCloseDrawer } from '../../actions/viewActions';
import { asyncChangeCurrentPartie, asyncGetPartieNews } from '../../actions/partiesActions';
import { checkDarkMode, checkDarkModeBackground } from '../../utils/CheckDarkMode.js';

const HOME = 'HOME';
const PARTIES = 'PARTIES';

class MenuBoard extends Component {
  constructor(props) {
    super(props)
    this.state = {
      opened: false
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
          this.setState({
            opened: !this.state.opened
          })
          return;
        }

        this.setState({
          opened: false
        })

        window.scrollTo(0, 0);
        this.props.changeView(currentElem);
        this.props.changeCurrentPartie("");
    }
    this.props.closeDrawer();
  }

  renderMainRow = () => {
    let data = [];

    if(this.props.current === HOME)
      data.push(<div key={HOME} className={'menuBoardnavElems noSelect' + checkDarkMode(this.props.darkMode, true)} onClick={() => this.elemFuncs(HOME)}>ÚLTIMAS NOTÍCIAS</div>);
    else
      data.push(<div key={HOME} className={'menuBoardnavElems noSelect' + checkDarkMode(this.props.darkMode)} onClick={() => this.elemFuncs(HOME)}>ÚLTIMAS NOTÍCIAS</div>);

    if(this.props.current  === PARTIES)
      data.push(<div key={PARTIES} className={'menuBoardnavElems noSelect' + checkDarkMode(this.props.darkMode, true)} onClick={() => this.elemFuncs(PARTIES)}>PARTIDOS</div>);
    else
      data.push(<div key={PARTIES} className={'menuBoardnavElems noSelect' + checkDarkMode(this.props.darkMode)} onClick={() => this.elemFuncs(PARTIES)}>PARTIDOS</div>);

    if(this.state.opened === true)
        data.push(this.renderPartieRow())

    return data;
  }

  renderPartieRow = () => {
    let data = [];

    if (this.props.parties.length !== 0) {
      for(let i = 0; i < this.props.parties.length; i++) {
        if(this.props.currentPartie.party_name === this.props.parties[i].party_name) {
          data.push(
              <div key={i} className={'menuBoardnavElems menuBoardPartieElem noSelect' + checkDarkMode(this.props.darkMode, true)} onClick={() => this.elemFuncs(this.props.parties[i], i)}>
                  { this.props.parties[i].party_name} : {this.props.parties[i].description }
              </div>
          );
        } else {
          data.push(
              <div key={i} className={'menuBoardnavElems menuBoardPartieElem noSelect' + checkDarkMode(this.props.darkMode)} onClick={() => this.elemFuncs(this.props.parties[i], i)}>
                 { this.props.parties[i].party_name} : { this.props.parties[i].description }
              </div>
          );
        }
      }
    }
    return data;
  }

  render() {
    return (
      <div className={(this.props.scroll ? 'menuBoardContainer menuBoardSticky' : 'menuBoardContainer') + checkDarkModeBackground(this.props.darkMode)}>
        <div className="iconsContainer noSelect">
          <i className={'material-icons menuBoardIcons' + checkDarkMode(this.props.DarkMode) }>whatshot</i>
        </div>
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

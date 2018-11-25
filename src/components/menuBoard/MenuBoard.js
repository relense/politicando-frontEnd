import React, { Component } from 'react';
import { connect } from 'react-redux';
import './MenuBoard.css';
import { asyncChangeView, asyncChangePartyView, asyncCloseDrawer } from '../../actions/viewActions';
import { asyncChangeCurrentPartie, asyncGetPartieNews } from '../../actions/partiesActions';

const HOME = 'HOME';
const PARTIES = 'PARTIES';
// const ABOUT = 'ABOUT';

class MenuBoard extends Component {
  constructor(props) {
    super(props)
    this.state = {
      opened: false
    }
  }

  selectPartie = (i) => {
    this.props.changeView("PARTIES");
    this.props.changeCurrentPartie(this.props.parties[i]);
    this.props.getPartieNews(this.props.parties[i].id);
  }

  elemFuncs = (currentElem, i = -1) => {
    if(i !== -1) {
      this.selectPartie(i);
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

  renderMainRow = (currentView, currentPartie) => {
    let data = [];

    if(this.props.current === HOME)
      data.push(<div key={HOME} className="menuBoardnavElems menuBoardselectedElem" onClick={() => this.elemFuncs(HOME)}>ÚLTIMAS NOTÍCIAS</div>);
    else
      data.push(<div key={HOME} className="menuBoardnavElems" onClick={() => this.elemFuncs(HOME)}>ÚLTIMAS NOTÍCIAS</div>);

    if(this.props.current  === PARTIES)
      data.push(<div key={PARTIES} className="menuBoardnavElems menuBoardselectedElem" onClick={() => this.elemFuncs(PARTIES)}>PARTIDOS</div>);
    else
      data.push(<div key={PARTIES} className="menuBoardnavElems" onClick={() => this.elemFuncs(PARTIES)}>PARTIDOS</div>);

    if(this.state.opened === true)
        data.push(this.renderPartieRow())

    // if(this.props.current  === ABOUT)
    //   data.push(<div key={ABOUT} className="menuBoardnavElems menuBoardselectedElem" onClick={() => this.elemFuncs(ABOUT)}>SOBRE</div>);
    // else
    //   data.push(<div key={ABOUT} className="menuBoardnavElems" onClick={() => this.elemFuncs(ABOUT)}>SOBRE</div>);

    return data;
  }

  renderPartieRow = () => {
    let data = [];

    if (this.props.parties.length !== 0) {
      for(let i = 0; i < this.props.parties.length; i++) {
        if(this.props.currentPartie.party_name === this.props.parties[i].party_name) {
          data.push(
              <div key={i} className="menuBoardnavElems menuBoardselectedElem menuBoardPartieElem partieButtons" onClick={() => this.elemFuncs(this.props.parties[i], i)}>
                  { this.props.parties[i].party_name} : {this.props.parties[i].description }
              </div>
          );
        } else {
          data.push(
              <div key={i} className="menuBoardnavElems menuBoardPartieElem partieButtons" onClick={() => this.elemFuncs(this.props.parties[i], i)}>
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
      <div className={this.props.scroll ? 'menuBoardContainer menuBoardSticky' : 'menuBoardContainer'}>
        <div className="iconsContainer">
          <i className="material-icons iconsMenuBoard">whatshot</i>
        </div>
        {this.renderMainRow(this.props.current, this.props.currentPartie)}
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
